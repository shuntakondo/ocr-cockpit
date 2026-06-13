import { computeTotals, type SampleDoc } from "@/lib/samples/data";

// Renders a SampleDoc to a self-contained SVG that looks like a real invoice or
// receipt. SVG is pure text (no native rendering needed), crisp in the preview
// pane, and its <text> nodes are readable by the OCR fallback.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value: number, currency: string): string {
  const code = currency.toUpperCase();
  const digits = code === "JPY" ? 0 : 2;
  const n = value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${code} ${n}`;
}

const INK = "#1f2937";
const MUTED = "#6b7280";
const ACCENT = "#2563eb";
const LINE = "#e5e7eb";
const ZEBRA = "#f9fafb";

function generateInvoiceSvg(doc: SampleDoc): string {
  const t = computeTotals(doc);
  const W = 760;
  const rowH = 30;
  const tableTop = 360;
  const rows = doc.lineItems
    .map((li, i) => {
      const y = tableTop + 36 + i * rowH;
      const amount = li.quantity * li.unitPrice;
      const zebra =
        i % 2 === 1
          ? `<rect x="40" y="${y - 20}" width="${W - 80}" height="${rowH}" fill="${ZEBRA}"/>`
          : "";
      return `${zebra}
    <text x="52" y="${y}" font-size="13" fill="${INK}">${esc(li.description)}</text>
    <text x="${W - 250}" y="${y}" font-size="13" fill="${INK}" text-anchor="end">${li.quantity}</text>
    <text x="${W - 150}" y="${y}" font-size="13" fill="${INK}" text-anchor="end">${money(li.unitPrice, doc.currency)}</text>
    <text x="${W - 52}" y="${y}" font-size="13" fill="${INK}" text-anchor="end">${money(amount, doc.currency)}</text>`;
    })
    .join("\n");

  const totalsTop = tableTop + 36 + doc.lineItems.length * rowH + 24;
  const H = totalsTop + 200;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="0" y="0" width="${W}" height="8" fill="${ACCENT}"/>

  <text x="40" y="64" font-size="22" font-weight="700" fill="${INK}">${esc(doc.vendor)}</text>
  <text x="40" y="86" font-size="12" fill="${MUTED}">${esc(doc.vendorAddress)}</text>
  <text x="40" y="104" font-size="12" fill="${MUTED}">Tax ID: ${esc(doc.vendorTaxId)}</text>

  <text x="${W - 40}" y="60" font-size="28" font-weight="700" fill="${ACCENT}" text-anchor="end">INVOICE</text>
  <text x="${W - 40}" y="86" font-size="13" fill="${INK}" text-anchor="end">No. ${esc(doc.invoiceNumber)}</text>
  <text x="${W - 40}" y="106" font-size="12" fill="${MUTED}" text-anchor="end">Issued: ${esc(doc.issueDate)}</text>
  <text x="${W - 40}" y="124" font-size="12" fill="${MUTED}" text-anchor="end">Due: ${esc(doc.dueDate)}</text>

  <text x="40" y="170" font-size="11" fill="${MUTED}">BILL TO</text>
  <text x="40" y="190" font-size="14" fill="${INK}">${esc(doc.billTo)}</text>

  <line x1="40" y1="${tableTop}" x2="${W - 40}" y2="${tableTop}" stroke="${ACCENT}" stroke-width="2"/>
  <text x="52" y="${tableTop + 22}" font-size="11" font-weight="700" fill="${MUTED}">DESCRIPTION</text>
  <text x="${W - 250}" y="${tableTop + 22}" font-size="11" font-weight="700" fill="${MUTED}" text-anchor="end">QTY</text>
  <text x="${W - 150}" y="${tableTop + 22}" font-size="11" font-weight="700" fill="${MUTED}" text-anchor="end">UNIT</text>
  <text x="${W - 52}" y="${tableTop + 22}" font-size="11" font-weight="700" fill="${MUTED}" text-anchor="end">AMOUNT</text>
${rows}
  <line x1="40" y1="${totalsTop - 8}" x2="${W - 40}" y2="${totalsTop - 8}" stroke="${LINE}" stroke-width="1"/>

  <text x="${W - 180}" y="${totalsTop + 18}" font-size="13" fill="${MUTED}" text-anchor="end">Subtotal</text>
  <text x="${W - 52}" y="${totalsTop + 18}" font-size="13" fill="${INK}" text-anchor="end">${money(t.subtotal, doc.currency)}</text>
  <text x="${W - 180}" y="${totalsTop + 42}" font-size="13" fill="${MUTED}" text-anchor="end">Tax (${doc.taxRate}%)</text>
  <text x="${W - 52}" y="${totalsTop + 42}" font-size="13" fill="${INK}" text-anchor="end">${money(t.taxAmount, doc.currency)}</text>
  <line x1="${W - 240}" y1="${totalsTop + 56}" x2="${W - 40}" y2="${totalsTop + 56}" stroke="${INK}" stroke-width="1"/>
  <text x="${W - 180}" y="${totalsTop + 80}" font-size="15" font-weight="700" fill="${INK}" text-anchor="end">Total</text>
  <text x="${W - 52}" y="${totalsTop + 80}" font-size="15" font-weight="700" fill="${ACCENT}" text-anchor="end">${money(t.total, doc.currency)}</text>

  <text x="40" y="${totalsTop + 130}" font-size="12" fill="${MUTED}">Payment terms: ${esc(doc.paymentTerms)}</text>
  <text x="40" y="${totalsTop + 150}" font-size="11" fill="${MUTED}">This is a fictional sample document generated for the OCR Cockpit demo.</text>
</svg>`;
}

function generateReceiptSvg(doc: SampleDoc): string {
  const t = computeTotals(doc);
  const W = 380;
  const rowTop = 230;
  const rowH = 26;
  const rows = doc.lineItems
    .map((li, i) => {
      const y = rowTop + i * rowH;
      const amount = li.quantity * li.unitPrice;
      return `  <text x="24" y="${y}" font-size="12" fill="${INK}">${esc(li.description)}</text>
  <text x="${W - 24}" y="${y}" font-size="12" fill="${INK}" text-anchor="end">${money(amount, doc.currency)}</text>
  <text x="24" y="${y + 13}" font-size="10" fill="${MUTED}">${li.quantity} × ${money(li.unitPrice, doc.currency)}</text>`;
    })
    .join("\n");

  const totalsTop = rowTop + doc.lineItems.length * rowH + 24;
  const H = totalsTop + 150;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Courier New', monospace">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${W / 2}" y="48" font-size="18" font-weight="700" fill="${INK}" text-anchor="middle">${esc(doc.vendor)}</text>
  <text x="${W / 2}" y="68" font-size="10" fill="${MUTED}" text-anchor="middle">${esc(doc.vendorAddress)}</text>
  <text x="${W / 2}" y="84" font-size="10" fill="${MUTED}" text-anchor="middle">Tax ID: ${esc(doc.vendorTaxId)}</text>
  <line x1="24" y1="104" x2="${W - 24}" y2="104" stroke="${INK}" stroke-dasharray="3 3"/>

  <text x="24" y="128" font-size="11" fill="${MUTED}">RECEIPT</text>
  <text x="${W - 24}" y="128" font-size="11" fill="${INK}" text-anchor="end">No. ${esc(doc.invoiceNumber)}</text>
  <text x="24" y="146" font-size="11" fill="${MUTED}">Date</text>
  <text x="${W - 24}" y="146" font-size="11" fill="${INK}" text-anchor="end">${esc(doc.issueDate)}</text>
  <line x1="24" y1="166" x2="${W - 24}" y2="166" stroke="${INK}" stroke-dasharray="3 3"/>

${rows}
  <line x1="24" y1="${totalsTop - 10}" x2="${W - 24}" y2="${totalsTop - 10}" stroke="${INK}" stroke-dasharray="3 3"/>
  <text x="24" y="${totalsTop + 8}" font-size="11" fill="${MUTED}">Subtotal</text>
  <text x="${W - 24}" y="${totalsTop + 8}" font-size="11" fill="${INK}" text-anchor="end">${money(t.subtotal, doc.currency)}</text>
  <text x="24" y="${totalsTop + 28}" font-size="11" fill="${MUTED}">Tax (${doc.taxRate}%)</text>
  <text x="${W - 24}" y="${totalsTop + 28}" font-size="11" fill="${INK}" text-anchor="end">${money(t.taxAmount, doc.currency)}</text>
  <text x="24" y="${totalsTop + 52}" font-size="14" font-weight="700" fill="${INK}">TOTAL</text>
  <text x="${W - 24}" y="${totalsTop + 52}" font-size="14" font-weight="700" fill="${INK}" text-anchor="end">${money(t.total, doc.currency)}</text>
  <text x="${W / 2}" y="${totalsTop + 88}" font-size="10" fill="${MUTED}" text-anchor="middle">${esc(doc.paymentTerms)}</text>
  <text x="${W / 2}" y="${totalsTop + 108}" font-size="9" fill="${MUTED}" text-anchor="middle">Fictional sample — OCR Cockpit demo</text>
</svg>`;
}

export function generateSvg(doc: SampleDoc): string {
  return doc.kind === "receipt"
    ? generateReceiptSvg(doc)
    : generateInvoiceSvg(doc);
}
