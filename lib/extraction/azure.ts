import type { ExtractionProvider, ExtractionInput } from "@/lib/extraction/types";
import { ExtractionError } from "@/lib/extraction/types";
import { buildExtractionData, type ProviderResult } from "@/lib/extraction/schema";
import type { ExtractionData } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Azure AI Document Intelligence (prebuilt-invoice / prebuilt-receipt). These
// prebuilt models return field-level confidence scores natively, which map
// directly onto the cockpit's confidence UI. Async REST flow: POST :analyze →
// poll Operation-Location → read analyzeResult.documents[0].fields.
// Docs: https://learn.microsoft.com/azure/ai-services/document-intelligence/
// ─────────────────────────────────────────────────────────────────────────────

const API_VERSION = "2024-11-30";

interface DiField {
  type?: string;
  content?: string;
  confidence?: number;
  valueString?: string;
  valueNumber?: number;
  valueInteger?: number;
  valueDate?: string;
  valueCurrency?: { amount?: number; currencyCode?: string };
  valueArray?: DiField[];
  valueObject?: Record<string, DiField>;
}

function readString(
  fields: Record<string, DiField>,
  names: string[],
): { value: string | null; confidence: number } {
  for (const n of names) {
    const f = fields[n];
    if (f) {
      const value = f.valueString ?? f.content ?? null;
      return { value, confidence: f.confidence ?? 0.5 };
    }
  }
  return { value: null, confidence: 0.2 };
}

function readNumber(
  fields: Record<string, DiField>,
  names: string[],
): { value: number | null; confidence: number } {
  for (const n of names) {
    const f = fields[n];
    if (f) {
      const value =
        f.valueCurrency?.amount ??
        f.valueNumber ??
        f.valueInteger ??
        (f.content ? Number(f.content.replace(/[^0-9.-]/g, "")) : null);
      return {
        value: value != null && !Number.isNaN(value) ? value : null,
        confidence: f.confidence ?? 0.5,
      };
    }
  }
  return { value: null, confidence: 0.2 };
}

function readDate(
  fields: Record<string, DiField>,
  names: string[],
): { value: string | null; confidence: number } {
  for (const n of names) {
    const f = fields[n];
    if (f) {
      return { value: f.valueDate ?? f.content ?? null, confidence: f.confidence ?? 0.5 };
    }
  }
  return { value: null, confidence: 0.2 };
}

function currencyCode(fields: Record<string, DiField>): {
  value: string | null;
  confidence: number;
} {
  const f =
    fields["InvoiceTotal"] || fields["Total"] || fields["AmountDue"] || fields["SubTotal"];
  const code = f?.valueCurrency?.currencyCode ?? null;
  return { value: code, confidence: code ? 0.9 : 0.3 };
}

function mapDocumentToResult(
  doc: { fields?: Record<string, DiField>; docType?: string },
): ProviderResult {
  const fields = doc.fields ?? {};
  const isReceipt = (doc.docType ?? "").includes("receipt");

  const items = fields["Items"]?.valueArray ?? [];
  const lineItems = items.map((item) => {
    const obj = item.valueObject ?? {};
    return {
      description: obj["Description"]?.valueString ?? obj["Description"]?.content ?? "",
      quantity: obj["Quantity"]?.valueNumber ?? null,
      unitPrice: obj["UnitPrice"]?.valueCurrency?.amount ?? obj["UnitPrice"]?.valueNumber ?? null,
      amount:
        obj["Amount"]?.valueCurrency?.amount ??
        obj["TotalPrice"]?.valueCurrency?.amount ??
        obj["Amount"]?.valueNumber ??
        null,
    };
  });

  return {
    documentKind: isReceipt ? "receipt" : "invoice",
    vendor: readString(fields, ["VendorName", "MerchantName"]),
    vendorTaxId: readString(fields, ["VendorTaxId", "TaxDetails"]),
    invoiceNumber: readString(fields, ["InvoiceId", "ReceiptNumber"]),
    issueDate: readDate(fields, ["InvoiceDate", "TransactionDate"]),
    dueDate: readDate(fields, ["DueDate"]),
    currency: currencyCode(fields),
    subtotal: readNumber(fields, ["SubTotal", "Subtotal"]),
    taxRate: { value: null, confidence: 0.2 },
    taxAmount: readNumber(fields, ["TotalTax", "Tax"]),
    total: readNumber(fields, ["InvoiceTotal", "Total", "AmountDue"]),
    paymentTerms: readString(fields, ["PaymentTerm"]),
    accountCode: { value: null, confidence: 0.1 },
    lineItems,
  };
}

export class AzureProvider implements ExtractionProvider {
  readonly name = "azure" as const;

  async extract(input: ExtractionInput): Promise<ExtractionData> {
    const endpoint = process.env.AZURE_DI_ENDPOINT;
    const key = process.env.AZURE_DI_KEY;
    const model = process.env.AZURE_DI_MODEL || "prebuilt-invoice";
    if (!endpoint || !key) {
      throw new ExtractionError(
        "Azure Document Intelligence is not configured. Set AZURE_DI_ENDPOINT and AZURE_DI_KEY.",
        "azure",
      );
    }

    const base = endpoint.replace(/\/$/, "");
    const analyzeUrl = `${base}/documentintelligence/documentModels/${model}:analyze?api-version=${API_VERSION}`;

    const start = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Source: Buffer.from(input.bytes).toString("base64"),
      }),
    });

    if (start.status !== 202) {
      const detail = await start.text().catch(() => "");
      throw new ExtractionError(
        `Azure analyze failed (HTTP ${start.status}). ${detail.slice(0, 300)}`,
        "azure",
      );
    }

    const opLocation = start.headers.get("operation-location");
    if (!opLocation) {
      throw new ExtractionError("Azure did not return an Operation-Location.", "azure");
    }

    // Poll for the result.
    const deadline = Date.now() + 120_000;
    let analyzeResult: {
      documents?: { fields?: Record<string, DiField>; docType?: string }[];
    } | null = null;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await fetch(opLocation, {
        headers: { "Ocp-Apim-Subscription-Key": key },
      });
      const body = (await poll.json()) as {
        status?: string;
        analyzeResult?: {
          documents?: { fields?: Record<string, DiField>; docType?: string }[];
        };
        error?: { message?: string };
      };
      if (body.status === "succeeded") {
        analyzeResult = body.analyzeResult ?? null;
        break;
      }
      if (body.status === "failed") {
        throw new ExtractionError(
          `Azure analysis failed: ${body.error?.message ?? "unknown error"}`,
          "azure",
        );
      }
    }

    if (!analyzeResult) {
      throw new ExtractionError("Azure analysis timed out.", "azure");
    }

    const doc = analyzeResult.documents?.[0];
    if (!doc) {
      throw new ExtractionError("Azure returned no documents.", "azure");
    }

    const result = mapDocumentToResult(doc);
    return buildExtractionData(result, "azure", null, new Date().toISOString());
  }
}
