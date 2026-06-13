import type { DocumentKind } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Self-authored fictional invoices & receipts. The single source of truth shared
// by the SVG generator (what gets drawn) and the mock provider (the "ground
// truth" it extracts, then perturbs slightly so there is something to review).
// All vendor names/addresses are invented. No real PII.
// ─────────────────────────────────────────────────────────────────────────────

export interface SampleLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface SampleDoc {
  filename: string;
  kind: DocumentKind;
  vendor: string;
  vendorAddress: string;
  vendorTaxId: string;
  invoiceNumber: string;
  issueDate: string; // ISO
  dueDate: string; // ISO
  currency: string;
  taxRate: number; // percent
  paymentTerms: string;
  accountCode: string;
  billTo: string;
  lineItems: SampleLine[];
}

export interface SampleTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

export function computeTotals(doc: SampleDoc): SampleTotals {
  const subtotal = doc.lineItems.reduce(
    (acc, li) => acc + li.quantity * li.unitPrice,
    0,
  );
  const taxAmount = Math.round((subtotal * doc.taxRate) / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

export const SAMPLE_DOCS: SampleDoc[] = [
  {
    filename: "sample-01-northwind-supplies.svg",
    kind: "invoice",
    vendor: "Northwind Office Supplies K.K.",
    vendorAddress: "2-4-1 Shibuya, Shibuya-ku, Tokyo 150-0002",
    vendorTaxId: "T1234567890123",
    invoiceNumber: "NW-2026-0481",
    issueDate: "2026-05-12",
    dueDate: "2026-06-30",
    currency: "JPY",
    taxRate: 10,
    paymentTerms: "Net 30",
    accountCode: "5400 Office Supplies",
    billTo: "Aoyama Design Studio",
    lineItems: [
      { description: "A4 copy paper (5,000 sheets)", quantity: 4, unitPrice: 2400 },
      { description: "Toner cartridge TK-3170", quantity: 2, unitPrice: 9800 },
      { description: "Whiteboard markers (12-pack)", quantity: 3, unitPrice: 1200 },
    ],
  },
  {
    filename: "sample-02-cloudscale-hosting.svg",
    kind: "invoice",
    vendor: "CloudScale Hosting Inc.",
    vendorAddress: "1200 Market St, San Francisco, CA 94102",
    vendorTaxId: "US-94-3271188",
    invoiceNumber: "CS-INV-77213",
    issueDate: "2026-05-01",
    dueDate: "2026-05-15",
    currency: "USD",
    taxRate: 0,
    paymentTerms: "Due on receipt",
    accountCode: "6100 Software & Hosting",
    billTo: "Aoyama Design Studio",
    lineItems: [
      { description: "Compute (8 vCPU plan) — May 2026", quantity: 1, unitPrice: 320 },
      { description: "Object storage 2TB", quantity: 1, unitPrice: 46 },
      { description: "Egress bandwidth", quantity: 1, unitPrice: 18 },
    ],
  },
  {
    filename: "sample-03-sakura-print.svg",
    kind: "invoice",
    vendor: "Sakura Print Works",
    vendorAddress: "3-15-2 Naka-ku, Yokohama 231-0023",
    vendorTaxId: "T9870001234567",
    invoiceNumber: "SP-260417",
    issueDate: "2026-04-17",
    dueDate: "2026-05-31",
    currency: "JPY",
    taxRate: 10,
    paymentTerms: "Net 45",
    accountCode: "5500 Marketing",
    billTo: "Aoyama Design Studio",
    lineItems: [
      { description: "Business cards (1,000 ea, 4 staff)", quantity: 4, unitPrice: 3500 },
      { description: "A2 poster, full color", quantity: 50, unitPrice: 480 },
    ],
  },
  {
    filename: "sample-04-meridian-legal.svg",
    kind: "invoice",
    vendor: "Meridian Legal Advisory",
    vendorAddress: "8-1 Marunouchi, Chiyoda-ku, Tokyo 100-0005",
    vendorTaxId: "T5550009998887",
    invoiceNumber: "MLA-2026-115",
    issueDate: "2026-05-20",
    dueDate: "2026-06-19",
    currency: "JPY",
    taxRate: 10,
    paymentTerms: "Net 30",
    accountCode: "6300 Professional Fees",
    billTo: "Aoyama Design Studio",
    lineItems: [
      { description: "Contract review (hourly)", quantity: 6, unitPrice: 25000 },
      { description: "Filing fees (pass-through)", quantity: 1, unitPrice: 12000 },
    ],
  },
  {
    filename: "sample-05-bistro-aoba-receipt.svg",
    kind: "receipt",
    vendor: "Bistro Aoba",
    vendorAddress: "1-7-3 Naka-Meguro, Meguro-ku, Tokyo",
    vendorTaxId: "T3330007776665",
    invoiceNumber: "R-88421",
    issueDate: "2026-05-23",
    dueDate: "2026-05-23",
    currency: "JPY",
    taxRate: 10,
    paymentTerms: "Paid (card)",
    accountCode: "7200 Meals & Entertainment",
    billTo: "—",
    lineItems: [
      { description: "Lunch course x3", quantity: 3, unitPrice: 1800 },
      { description: "Sparkling water", quantity: 3, unitPrice: 400 },
    ],
  },
  {
    filename: "sample-06-tokyo-taxi-receipt.svg",
    kind: "receipt",
    vendor: "Tokyo Metro Taxi",
    vendorAddress: "Minato-ku, Tokyo",
    vendorTaxId: "T1110002223334",
    invoiceNumber: "TX-0926-3318",
    issueDate: "2026-05-09",
    dueDate: "2026-05-09",
    currency: "JPY",
    taxRate: 10,
    paymentTerms: "Paid (cash)",
    accountCode: "7400 Travel",
    billTo: "—",
    lineItems: [{ description: "Fare — Shibuya to Haneda", quantity: 1, unitPrice: 6820 }],
  },
  {
    filename: "sample-07-helios-electric.svg",
    kind: "invoice",
    vendor: "Helios Electric Co.",
    vendorAddress: "5-2-1 Yodogawa-ku, Osaka 532-0011",
    vendorTaxId: "T7778889990001",
    invoiceNumber: "HE-2026-0042",
    issueDate: "2026-04-30",
    dueDate: "2026-05-31",
    currency: "JPY",
    taxRate: 10,
    paymentTerms: "Net 30",
    accountCode: "6200 Utilities",
    billTo: "Aoyama Design Studio",
    lineItems: [{ description: "Electricity — April 2026 (office)", quantity: 1, unitPrice: 38400 }],
  },
  {
    filename: "sample-08-bright-eu-design.svg",
    kind: "invoice",
    vendor: "Bright EU Design GmbH",
    vendorAddress: "Friedrichstrasse 68, 10117 Berlin",
    vendorTaxId: "DE321654987",
    invoiceNumber: "BED-2026-309",
    issueDate: "2026-05-18",
    dueDate: "2026-06-17",
    currency: "EUR",
    taxRate: 19,
    paymentTerms: "Net 30",
    accountCode: "5500 Marketing",
    billTo: "Aoyama Design Studio",
    lineItems: [
      { description: "Brand guidelines refresh", quantity: 1, unitPrice: 1800 },
      { description: "Icon set (40 icons)", quantity: 1, unitPrice: 640 },
    ],
  },
  {
    filename: "sample-09-greenleaf-coffee-receipt.svg",
    kind: "receipt",
    vendor: "Greenleaf Coffee Stand",
    vendorAddress: "2-2-2 Jingumae, Shibuya-ku, Tokyo",
    vendorTaxId: "T2223334445556",
    invoiceNumber: "GL-220515",
    issueDate: "2026-05-15",
    dueDate: "2026-05-15",
    currency: "JPY",
    taxRate: 8,
    paymentTerms: "Paid (IC card)",
    accountCode: "7200 Meals & Entertainment",
    billTo: "—",
    lineItems: [
      { description: "Drip coffee", quantity: 4, unitPrice: 480 },
      { description: "Scone", quantity: 2, unitPrice: 360 },
    ],
  },
  {
    filename: "sample-10-apex-logistics.svg",
    kind: "invoice",
    vendor: "Apex Logistics Ltd.",
    vendorAddress: "12-4 Kanda, Chiyoda-ku, Tokyo 101-0047",
    vendorTaxId: "T6667778889990",
    invoiceNumber: "APX-2026-2271",
    issueDate: "2026-05-06",
    dueDate: "2026-06-05",
    currency: "JPY",
    taxRate: 10,
    paymentTerms: "Net 30",
    accountCode: "5600 Shipping",
    billTo: "Aoyama Design Studio",
    lineItems: [
      { description: "Domestic freight (palletized)", quantity: 8, unitPrice: 4200 },
      { description: "Fuel surcharge", quantity: 1, unitPrice: 3360 },
    ],
  },
  {
    filename: "sample-11-summit-consulting.svg",
    kind: "invoice",
    vendor: "Summit Consulting Partners",
    vendorAddress: "601 Lexington Ave, New York, NY 10022",
    vendorTaxId: "US-13-5559921",
    invoiceNumber: "SCP-9912",
    issueDate: "2026-05-25",
    dueDate: "2026-06-24",
    currency: "USD",
    taxRate: 0,
    paymentTerms: "Net 30",
    accountCode: "6300 Professional Fees",
    billTo: "Aoyama Design Studio",
    lineItems: [
      { description: "Advisory retainer — May 2026", quantity: 1, unitPrice: 4500 },
      { description: "Workshop facilitation (1 day)", quantity: 1, unitPrice: 2200 },
    ],
  },
  {
    filename: "sample-12-momiji-stationery-receipt.svg",
    kind: "receipt",
    vendor: "Momiji Stationery",
    vendorAddress: "4-1-1 Sakae, Naka-ku, Nagoya 460-0008",
    vendorTaxId: "T4445556667778",
    invoiceNumber: "MS-0530-77",
    issueDate: "2026-05-30",
    dueDate: "2026-05-30",
    currency: "JPY",
    taxRate: 10,
    paymentTerms: "Paid (card)",
    accountCode: "5400 Office Supplies",
    billTo: "—",
    lineItems: [
      { description: "Notebooks (A5, 10-pack)", quantity: 2, unitPrice: 980 },
      { description: "Gel pens (assorted)", quantity: 12, unitPrice: 150 },
      { description: "Sticky notes", quantity: 5, unitPrice: 240 },
    ],
  },
];

export function findSampleByFilename(filename: string): SampleDoc | undefined {
  return SAMPLE_DOCS.find((d) => d.filename === filename);
}
