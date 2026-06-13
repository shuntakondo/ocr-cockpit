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

const STRING_KEYS = [
  "vendor",
  "vendorTaxId",
  "invoiceNumber",
  "issueDate",
  "dueDate",
  "currency",
  "paymentTerms",
  "accountCode",
] as const;
const NUMBER_KEYS = ["subtotal", "taxRate", "taxAmount", "total"] as const;

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) && v.trim() !== "" ? n : null;
  }
  return null;
}

function toStr(v: unknown): string | null {
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

/** Coerce whatever an LLM produced for a field into a canonical {value, confidence}. */
function coerceField(raw: unknown, kind: "string" | "number") {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const conf = typeof o.confidence === "number" ? clamp01(o.confidence) : 0.6;
    return {
      value: kind === "number" ? toNum(o.value) : toStr(o.value),
      confidence: conf,
    };
  }
  if (raw != null) {
    // Model returned a bare scalar instead of {value, confidence}.
    return { value: kind === "number" ? toNum(raw) : toStr(raw), confidence: 0.6 };
  }
  // Missing / null → low confidence.
  return { value: null, confidence: 0.3 };
}

function coerceLine(li: unknown) {
  if (!li || typeof li !== "object") {
    return { description: "", quantity: null, unitPrice: null, amount: null };
  }
  const o = li as Record<string, unknown>;
  return {
    description: toStr(o.description) ?? "",
    quantity: toNum(o.quantity),
    unitPrice: toNum(o.unitPrice),
    amount: toNum(o.amount),
  };
}

/**
 * Tolerant schema: a preprocessing pass first normalizes loose LLM output —
 * missing fields, nulls, bare scalars, stringified numbers, "¥1,000" — into the
 * canonical shape, so a single dropped field never fails the whole extraction.
 */
export const ProviderResultSchema = z.preprocess((raw): unknown => {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {
    documentKind: r.documentKind === "receipt" ? "receipt" : "invoice",
    lineItems: Array.isArray(r.lineItems) ? r.lineItems.map(coerceLine) : [],
  };
  for (const k of STRING_KEYS) out[k] = coerceField(r[k], "string");
  for (const k of NUMBER_KEYS) out[k] = coerceField(r[k], "number");
  return out;
}, z.object({
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
  accountCode: stringField,
  lineItems: z.array(lineItemSchema).catch([]),
}));

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

Field hints:
- "vendor" is the SELLER / issuer of the document — usually the company name at the very top. It is NOT the "Bill To" / customer / recipient.
- "invoiceNumber" is the document number, usually printed near "Invoice No.", "No.", "#" or "Receipt No.".
- "vendorTaxId" is the tax / registration number (e.g. labelled "Tax ID", an invoice registration number).
- "issueDate" is when the document was issued; "dueDate" is the payment due date.

Rules:
- "confidence" reflects how sure you are about each field (1 = certain, 0 = guess).
- Amounts are plain numbers with no currency symbols or thousands separators.
- Dates are ISO (YYYY-MM-DD). If a field is absent, use null with low confidence.
- "currency" is an ISO code (JPY, USD, EUR, ...).
- Do not invent values. If you cannot find a field, use null. Output JSON only.`;

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
