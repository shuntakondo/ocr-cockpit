import type { DocumentRecord, FieldKey } from "@/lib/types";
import { statusLabel } from "@/lib/types";

/**
 * Render a CSV cell: neutralize spreadsheet formula injection (a leading
 * = + - @ or control char is prefixed with an apostrophe), then quote when the
 * value contains a comma, quote, or newline.
 */
export function csvCell(value: unknown): string {
  if (value == null) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\r\n");
}

function field(doc: DocumentRecord, key: FieldKey): string | number | null {
  return doc.extraction ? (doc.extraction[key]?.value ?? null) : null;
}

/** A flat, one-row-per-document CSV with the core header fields. */
export function documentsToCsv(docs: DocumentRecord[]): string {
  const headers = [
    "Document ID",
    "Status",
    "Kind",
    "Vendor",
    "Vendor Tax ID",
    "Invoice No.",
    "Issue Date",
    "Due Date",
    "Currency",
    "Subtotal",
    "Tax",
    "Total",
    "Account Code",
    "Original Filename",
  ];
  const rows = docs.map((d) => [
    d.id,
    statusLabel(d.status),
    d.extraction?.documentKind ?? d.kind,
    field(d, "vendor"),
    field(d, "vendorTaxId"),
    field(d, "invoiceNumber"),
    field(d, "issueDate"),
    field(d, "dueDate"),
    field(d, "currency"),
    field(d, "subtotal"),
    field(d, "taxAmount"),
    field(d, "total"),
    field(d, "accountCode"),
    d.originalFilename,
  ]);
  return toCsv(headers, rows);
}
