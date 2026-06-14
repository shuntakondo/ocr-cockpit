// Detect invoice boundaries within a multi-page PDF so an uploaded file can be
// auto-split into one document per invoice — without asking the user.
//
// Heuristic (free, deterministic, no LLM): walk the pages and start a new group
// when a page clearly begins a different invoice. Signals:
//   • a NEW invoice number that differs from the current group's, or
//   • an invoice/receipt header right after the previous page showed a total.
// A page with no detectable invoice number continues the current group — so a
// single invoice spanning several pages stays together.

export interface PageGroup {
  start: number; // 1-based, inclusive
  end: number; // 1-based, inclusive
}

const INVOICE_NO =
  /(?:invoice\s*(?:no\.?|number|#)|請求書?\s*番号|bill\s*no\.?|tax\s*invoice\s*no\.?)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9/\-]*\d[A-Za-z0-9/\-]*)/i;
const HEADER = /\b(invoice|tax invoice|receipt)\b|請求書|領収書|納品書/i;
const TOTAL =
  /\b(total|amount due|balance due|grand total)\b|合計|ご請求金額|お支払金額|総額/i;

function invoiceNumber(text: string): string | null {
  const m = text.match(INVOICE_NO);
  return m && /\d/.test(m[1]) ? m[1].trim() : null;
}

/**
 * Group consecutive pages into invoices. Returns one contiguous range per
 * detected invoice. For 0/1 page, returns a single whole-document group.
 */
export function detectInvoiceGroups(pageTexts: string[]): PageGroup[] {
  const n = pageTexts.length;
  if (n <= 1) return [{ start: 1, end: Math.max(1, n) }];

  const info = pageTexts.map((t) => ({
    no: invoiceNumber(t),
    header: HEADER.test(t),
    total: TOTAL.test(t),
  }));

  const groups: PageGroup[] = [];
  let cur = { start: 1, end: 1, no: info[0].no };

  for (let i = 1; i < n; i++) {
    const p = info[i];
    const prev = info[i - 1];
    let boundary = false;

    if (p.no && cur.no && p.no !== cur.no) {
      boundary = true; // a different invoice number → new invoice
    } else if (p.no && cur.no && p.no === cur.no) {
      boundary = false; // same number repeated → same multi-page invoice
    } else if (p.no && !cur.no && prev.total) {
      boundary = true; // current group had no number; a number appears after a total
    } else if (!p.no && p.header && prev.total && !cur.no) {
      boundary = true; // numberless docs: header right after a total ends the prev one
    }

    if (boundary) {
      groups.push({ start: cur.start, end: cur.end });
      cur = { start: i + 1, end: i + 1, no: p.no };
    } else {
      cur.end = i + 1;
      if (!cur.no && p.no) cur.no = p.no; // adopt a number found on a later page
    }
  }
  groups.push({ start: cur.start, end: cur.end });
  return groups;
}
