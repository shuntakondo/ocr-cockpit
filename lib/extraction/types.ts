import type { DocumentKind, ExtractionData, ProviderName } from "@/lib/types";

/** Raw document handed to a provider for extraction. */
export interface ExtractionInput {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  kind: DocumentKind;
  /** 1-based page for split multi-page PDFs; null/undefined = whole file. */
  page?: number | null;
}

/**
 * A pluggable extraction backend. Implementations live alongside this file:
 * `mock` (default, deterministic, zero-dependency), `ollama` (local/free),
 * `azure` (Azure AI Document Intelligence). Selected at runtime by env via
 * `getProvider()` in ./index.ts.
 */
export interface ExtractionProvider {
  readonly name: ProviderName;
  extract(input: ExtractionInput): Promise<ExtractionData>;
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}
