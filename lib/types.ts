// ─────────────────────────────────────────────────────────────────────────────
// Domain types — shared by the BFF, the extraction providers, and the UI.
// Pure types + a field registry; no runtime dependencies, safe to import anywhere.
// ─────────────────────────────────────────────────────────────────────────────

/** Lifecycle of a document moving through the cockpit. */
export type DocumentStatus =
  | "uploaded" // received, not yet extracted
  | "processing" // extraction in flight
  | "needs_review" // extracted, awaiting human confirmation
  | "approved" // a human confirmed the fields
  | "exported" // pushed to CSV / Sheets / accounting
  | "error"; // extraction failed

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "uploaded",
  "processing",
  "needs_review",
  "approved",
  "exported",
  "error",
];

export type DocumentKind = "invoice" | "receipt";

export type DocumentSource = "upload" | "sample" | "gmail" | "drive";

export type ProviderName = "mock" | "ollama" | "azure" | "gemini";

/**
 * A single reviewable field. Carries the human-facing `value`, the provider's
 * confidence, the original `providerValue` (so the UI can show a correction
 * diff), and whether a human has `edited` it.
 */
export interface Field<T extends string | number> {
  value: T | null;
  confidence: number; // 0..1
  providerValue: T | null;
  edited: boolean;
}

export interface LineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

/** The full structured result attached to a document (stored as JSONB). */
export interface ExtractionData {
  documentKind: DocumentKind;
  vendor: Field<string>;
  vendorTaxId: Field<string>; // インボイス番号 / registration no.
  invoiceNumber: Field<string>;
  issueDate: Field<string>; // ISO yyyy-mm-dd
  dueDate: Field<string>;
  currency: Field<string>;
  subtotal: Field<number>;
  taxRate: Field<number>; // percent, e.g. 10
  taxAmount: Field<number>;
  total: Field<number>;
  paymentTerms: Field<string>;
  accountCode: Field<string>; // 勘定科目 — for accounting/ERP export
  lineItems: LineItem[];
  rawText: string | null;
  providerName: ProviderName;
  warnings: string[]; // consistency checks, e.g. "subtotal + tax ≠ total"
  extractedAt: string; // ISO timestamp
}

export interface DocumentRecord {
  id: string;
  filename: string; // stored filename (on disk / in storage)
  originalFilename: string;
  mimeType: string;
  kind: DocumentKind;
  source: DocumentSource;
  sizeBytes: number;
  status: DocumentStatus;
  extraction: ExtractionData | null;
  notes: string | null;
  /** First page of this document's range within a multi-page PDF (1-based). null = whole file. */
  page: number | null;
  /** Last page of the range. null when single-page (== page) or whole file. */
  pageEnd: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  documentId: string;
  action: string; // e.g. "uploaded", "extracted", "field_edited", "approved", "exported"
  detail: string | null;
  createdAt: string;
}

/** Vendor-level learned defaults, re-applied to future documents. */
export interface VendorRule {
  vendor: string;
  accountCode: string | null;
  taxRate: number | null;
  updatedAt: string;
}

// ── Field registry ────────────────────────────────────────────────────────────
// Drives generic rendering in the review pane and column ordering in exports.
// Keys are the `Field`-typed members of ExtractionData.

export type FieldKey =
  | "vendor"
  | "vendorTaxId"
  | "invoiceNumber"
  | "issueDate"
  | "dueDate"
  | "currency"
  | "subtotal"
  | "taxRate"
  | "taxAmount"
  | "total"
  | "paymentTerms"
  | "accountCode";

export interface FieldSpec {
  key: FieldKey;
  label: string; // English only (per project copy rules)
  type: "text" | "number" | "date" | "money";
  group: "party" | "identifiers" | "dates" | "amounts" | "accounting";
}

export const FIELD_SPECS: FieldSpec[] = [
  { key: "vendor", label: "Vendor", type: "text", group: "party" },
  { key: "vendorTaxId", label: "Vendor Tax ID", type: "text", group: "identifiers" },
  { key: "invoiceNumber", label: "Invoice No.", type: "text", group: "identifiers" },
  { key: "issueDate", label: "Issue Date", type: "date", group: "dates" },
  { key: "dueDate", label: "Due Date", type: "date", group: "dates" },
  { key: "currency", label: "Currency", type: "text", group: "amounts" },
  { key: "subtotal", label: "Subtotal", type: "money", group: "amounts" },
  { key: "taxRate", label: "Tax Rate (%)", type: "number", group: "amounts" },
  { key: "taxAmount", label: "Tax", type: "money", group: "amounts" },
  { key: "total", label: "Total", type: "money", group: "amounts" },
  { key: "paymentTerms", label: "Payment Terms", type: "text", group: "accounting" },
  { key: "accountCode", label: "Account Code", type: "text", group: "accounting" },
];

/** Confidence below this is flagged for human attention in the UI. */
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export function statusLabel(status: DocumentStatus): string {
  switch (status) {
    case "uploaded":
      return "Uploaded";
    case "processing":
      return "Processing";
    case "needs_review":
      return "Needs Review";
    case "approved":
      return "Approved";
    case "exported":
      return "Exported";
    case "error":
      return "Error";
  }
}
