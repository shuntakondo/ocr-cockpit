import type { ExtractionProvider, ExtractionInput } from "@/lib/extraction/types";
import { buildExtractionData, type ProviderResult } from "@/lib/extraction/schema";
import type { ExtractionData } from "@/lib/types";
import {
  computeTotals,
  findSampleByFilename,
  type SampleDoc,
} from "@/lib/samples/data";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic, zero-dependency extractor. Lets the whole cockpit run end-to-end
// with no Ollama server and no Azure key. For seeded sample documents it returns
// their ground truth, then perturbs a field or two (and lowers confidences) so
// the review experience is realistic; for real uploads it synthesizes plausible
// values from the filename.
// ─────────────────────────────────────────────────────────────────────────────

function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fromSample(sample: SampleDoc, rand: () => number): ProviderResult {
  const totals = computeTotals(sample);

  // Decide which fields to "misread" for this document (deterministic).
  const perturbTotal = rand() < 0.4;
  const total = perturbTotal
    ? totals.total + (rand() < 0.5 ? 100 : -100) // off-by-a-bit so the warning fires
    : totals.total;

  return {
    documentKind: sample.kind,
    vendor: { value: sample.vendor, confidence: 0.97 },
    vendorTaxId: { value: sample.vendorTaxId, confidence: 0.56 }, // IDs are easy to misread
    invoiceNumber: { value: sample.invoiceNumber, confidence: 0.91 },
    issueDate: { value: sample.issueDate, confidence: 0.93 },
    dueDate: { value: sample.dueDate, confidence: 0.82 },
    currency: { value: sample.currency, confidence: 0.98 },
    subtotal: { value: totals.subtotal, confidence: 0.9 },
    taxRate: { value: sample.taxRate, confidence: 0.88 },
    taxAmount: { value: totals.taxAmount, confidence: 0.86 },
    total: { value: total, confidence: perturbTotal ? 0.54 : 0.92 },
    paymentTerms: { value: sample.paymentTerms, confidence: 0.74 },
    accountCode: { value: sample.accountCode, confidence: 0.68 },
    lineItems: sample.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.quantity * li.unitPrice,
    })),
  };
}

function synthesize(filename: string, rand: () => number): ProviderResult {
  const base = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
  const vendor =
    base
      .split(" ")
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Unknown Vendor";

  const lineCount = 1 + Math.floor(rand() * 3);
  const lineItems = Array.from({ length: lineCount }, (_, i) => {
    const quantity = 1 + Math.floor(rand() * 5);
    const unitPrice = (1 + Math.floor(rand() * 40)) * 500;
    return {
      description: `Item ${i + 1}`,
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
    };
  });
  const subtotal = lineItems.reduce((a, li) => a + li.amount, 0);
  const taxRate = 10;
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const day = 1 + Math.floor(rand() * 27);
  const issueDate = `2026-05-${String(day).padStart(2, "0")}`;

  return {
    documentKind: rand() < 0.3 ? "receipt" : "invoice",
    vendor: { value: vendor, confidence: 0.7 },
    vendorTaxId: { value: null, confidence: 0.3 },
    invoiceNumber: {
      value: `INV-${String(hash(filename) % 100000).padStart(5, "0")}`,
      confidence: 0.62,
    },
    issueDate: { value: issueDate, confidence: 0.66 },
    dueDate: { value: null, confidence: 0.2 },
    currency: { value: "JPY", confidence: 0.8 },
    subtotal: { value: subtotal, confidence: 0.72 },
    taxRate: { value: taxRate, confidence: 0.7 },
    taxAmount: { value: taxAmount, confidence: 0.68 },
    total: { value: subtotal + taxAmount, confidence: 0.74 },
    paymentTerms: { value: null, confidence: 0.25 },
    accountCode: { value: null, confidence: 0.2 },
    lineItems,
  };
}

export class MockProvider implements ExtractionProvider {
  readonly name = "mock" as const;

  async extract(input: ExtractionInput): Promise<ExtractionData> {
    const rand = mulberry32(hash(input.filename));
    const sample = findSampleByFilename(input.filename);
    const result = sample ? fromSample(sample, rand) : synthesize(input.filename, rand);
    // Small simulated latency so the "Processing" state is visible in the UI.
    await new Promise((r) => setTimeout(r, 400));
    return buildExtractionData(result, "mock", null, new Date().toISOString());
  }
}
