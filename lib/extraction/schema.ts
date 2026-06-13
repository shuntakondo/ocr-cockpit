import { z } from "zod";
import type {
  ExtractionData,
  Field,
  LineItem,
  ProviderName,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// The contract every extraction provider produces. LLM-backed providers are
// prompted to emit exactly this JSON; we validate it with Zod before trusting it.
// ─────────────────────────────────────────────────────────────────────────────

const confidence = z.number().min(0).max(1).catch(0.5);

const stringField = z.object({
  value: z.string().nullable().catch(null),
  confidence,
});

const numberField = z.object({
  value: z.number().nullable().catch(null),
  confidence,
});

const lineItemSchema = z.object({
  description: z.string().catch(""),
  quantity: z.number().nullable().catch(null),
  unitPrice: z.number().nullable().catch(null),
  amount: z.number().nullable().catch(null),
});

export const ProviderResultSchema = z.object({
  documentKind: z.enum(["invoice", "receipt"]).catch("invoice"),
  vendor: stringField,
  vendorTaxId: stringField,
  invoiceNumber: stringField,
  issueDate: stringField,
  dueDate: stringField,
  currency: stringField,
  subtotal: numberField,
  taxRate: numberField,
  taxAmount: numberField,
  total: numberField,
  paymentTerms: stringField,
  accountCode: stringField.optional(),
  lineItems: z.array(lineItemSchema).catch([]),
});

export type ProviderResult = z.infer<typeof ProviderResultSchema>;

/** Instructions handed to an LLM so it returns a parseable ProviderResult. */
export const EXTRACTION_JSON_INSTRUCTIONS = `You are an accounts-payable data-extraction engine. Read the document and return ONLY a JSON object (no markdown, no prose) with this exact shape:

{
  "documentKind": "invoice" | "receipt",
  "vendor":        { "value": string | null, "confidence": 0..1 },
  "vendorTaxId":   { "value": string | null, "confidence": 0..1 },
  "invoiceNumber": { "value": string | null, "confidence": 0..1 },
  "issueDate":     { "value": "YYYY-MM-DD" | null, "confidence": 0..1 },
  "dueDate":       { "value": "YYYY-MM-DD" | null, "confidence": 0..1 },
  "currency":      { "value": string | null, "confidence": 0..1 },
  "subtotal":      { "value": number | null, "confidence": 0..1 },
  "taxRate":       { "value": number | null, "confidence": 0..1 },
  "taxAmount":     { "value": number | null, "confidence": 0..1 },
  "total":         { "value": number | null, "confidence": 0..1 },
  "paymentTerms":  { "value": string | null, "confidence": 0..1 },
  "accountCode":   { "value": string | null, "confidence": 0..1 },
  "lineItems": [ { "description": string, "quantity": number | null, "unitPrice": number | null, "amount": number | null } ]
}

Rules:
- "confidence" reflects how sure you are about each field (1 = certain, 0 = guess).
- Amounts are plain numbers with no currency symbols or thousands separators.
- Dates are ISO (YYYY-MM-DD). If a field is absent, use null with low confidence.
- "currency" is an ISO code (JPY, USD, EUR, ...).
- Do not invent values. Output JSON only.`;

function toField<T extends string | number>(
  raw: { value: T | null; confidence: number } | undefined,
): Field<T> {
  const value = raw?.value ?? null;
  const confidence = clamp01(raw?.confidence ?? 0.5);
  return { value, confidence, providerValue: value, edited: false };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/** Convert a validated provider result into the stored/reviewable ExtractionData. */
export function buildExtractionData(
  result: ProviderResult,
  providerName: ProviderName,
  rawText: string | null,
  extractedAt: string,
): ExtractionData {
  const lineItems: LineItem[] = result.lineItems.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    amount: li.amount,
  }));

  const data: ExtractionData = {
    documentKind: result.documentKind,
    vendor: toField(result.vendor),
    vendorTaxId: toField(result.vendorTaxId),
    invoiceNumber: toField(result.invoiceNumber),
    issueDate: toField(result.issueDate),
    dueDate: toField(result.dueDate),
    currency: toField(result.currency),
    subtotal: toField(result.subtotal),
    taxRate: toField(result.taxRate),
    taxAmount: toField(result.taxAmount),
    total: toField(result.total),
    paymentTerms: toField(result.paymentTerms),
    accountCode: toField(result.accountCode),
    lineItems,
    rawText,
    providerName,
    warnings: [],
    extractedAt,
  };

  data.warnings = computeWarnings(data);
  return data;
}

/**
 * Lightweight consistency checks surfaced to the reviewer. Recomputed after
 * every human edit so the cockpit always reflects the current values.
 */
export function computeWarnings(data: ExtractionData): string[] {
  const warnings: string[] = [];
  const subtotal = data.subtotal.value;
  const tax = data.taxAmount.value;
  const total = data.total.value;

  if (subtotal != null && tax != null && total != null) {
    const expected = subtotal + tax;
    if (Math.abs(expected - total) > 1) {
      warnings.push(
        `Subtotal + tax (${expected.toLocaleString()}) does not match total (${total.toLocaleString()}).`,
      );
    }
  }

  if (total == null) warnings.push("Total amount is missing.");
  if (data.vendor.value == null || data.vendor.value.trim() === "")
    warnings.push("Vendor is missing.");
  if (data.issueDate.value == null)
    warnings.push("Issue date is missing.");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.issueDate.value))
    warnings.push("Issue date is not a valid ISO date.");

  const lineSum = data.lineItems.reduce(
    (acc, li) => acc + (li.amount ?? 0),
    0,
  );
  if (data.lineItems.length > 0 && subtotal != null) {
    if (Math.abs(lineSum - subtotal) > 1) {
      warnings.push(
        `Line items total (${lineSum.toLocaleString()}) does not match subtotal (${subtotal.toLocaleString()}).`,
      );
    }
  }

  return warnings;
}
