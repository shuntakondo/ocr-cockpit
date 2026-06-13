import type { DocumentRecord } from "@/lib/types";
import { toCsv } from "@/lib/export/csv";

// ─────────────────────────────────────────────────────────────────────────────
// A journal-style export shaped for accounting-software import (freee /
// QuickBooks style). Headers are kept generic and English; remap the column
// names to a specific package's import template as needed. One journal line per
// document — the payable/expense booked against its account code.
// ─────────────────────────────────────────────────────────────────────────────

export function documentsToAccountingCsv(docs: DocumentRecord[]): string {
  const headers = [
    "Date", // issue date
    "Account", // 勘定科目 / expense account
    "Tax Category", // 税区分 (e.g. taxable 10%)
    "Amount", // gross total
    "Tax Amount",
    "Currency",
    "Partner", // 取引先 / vendor
    "Document No.",
    "Memo",
  ];

  const rows = docs.map((d) => {
    const e = d.extraction;
    const taxRate = e?.taxRate?.value ?? null;
    const taxCategory =
      taxRate == null ? "" : taxRate === 0 ? "Tax-exempt" : `Taxable ${taxRate}%`;
    return [
      e?.issueDate?.value ?? "",
      e?.accountCode?.value ?? "",
      taxCategory,
      e?.total?.value ?? "",
      e?.taxAmount?.value ?? "",
      e?.currency?.value ?? "",
      e?.vendor?.value ?? "",
      e?.invoiceNumber?.value ?? "",
      `${e?.documentKind ?? d.kind} — ${d.originalFilename}`,
    ];
  });

  return toCsv(headers, rows);
}
