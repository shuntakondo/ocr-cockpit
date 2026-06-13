import { computeWarnings } from "@/lib/extraction/schema";
import { FIELD_SPECS, type ExtractionData, type VendorRule } from "@/lib/types";

/**
 * After a human edit, recompute each field's `edited` flag (value differs from
 * the provider's original) and re-run the consistency checks. Returns a fresh
 * object; the input is not mutated.
 */
export function normalizeExtraction(data: ExtractionData): ExtractionData {
  const next = structuredClone(data);
  for (const spec of FIELD_SPECS) {
    const f = next[spec.key];
    f.edited = f.value !== f.providerValue;
  }
  next.warnings = computeWarnings(next);
  return next;
}

/** Pre-fill account code / tax rate from a previously confirmed vendor rule. */
export function applyVendorRule(
  data: ExtractionData,
  rule: VendorRule,
): ExtractionData {
  const next = structuredClone(data);
  if (rule.accountCode && !next.accountCode.value) {
    next.accountCode = {
      value: rule.accountCode,
      confidence: 0.9,
      providerValue: next.accountCode.providerValue,
      edited: false,
    };
  }
  if (rule.taxRate != null && next.taxRate.value == null) {
    next.taxRate = {
      value: rule.taxRate,
      confidence: 0.9,
      providerValue: next.taxRate.providerValue,
      edited: false,
    };
  }
  next.warnings = computeWarnings(next);
  return next;
}
