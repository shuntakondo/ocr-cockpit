import type { ExtractionData } from "@/lib/types";

// Heuristic backstops for fields a small text LLM tends to drop. These run only
// when OCR/source text is available and only fill fields the model left empty,
// at a deliberately modest confidence (it's a rule, not the model's read).

const INVOICE_NO =
  /\b(?:invoice\s*(?:no|number)|no|#)\b\.?\s*:?\s*([A-Za-z0-9][A-Za-z0-9/-]{3,})/i;

export function backfillFromText(data: ExtractionData): ExtractionData {
  const text = data.rawText;
  if (!text) return data;

  if (!data.invoiceNumber.value) {
    const m = text.match(INVOICE_NO);
    if (m && /\d/.test(m[1])) {
      data.invoiceNumber = {
        value: m[1],
        confidence: 0.55,
        providerValue: m[1],
        edited: false,
      };
    }
  }

  return data;
}
