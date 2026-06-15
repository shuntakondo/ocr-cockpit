import type { ExtractionProvider } from "@/lib/extraction/types";
import type { ProviderName } from "@/lib/types";
import { MockProvider } from "@/lib/extraction/mock";
import { OllamaProvider } from "@/lib/extraction/ollama";
import { AzureProvider } from "@/lib/extraction/azure";
import { GeminiProvider } from "@/lib/extraction/gemini";

export type { ExtractionProvider, ExtractionInput } from "@/lib/extraction/types";

/** Resolve the active extraction provider from EXTRACTION_PROVIDER (default: mock). */
export function getProvider(name?: string): ExtractionProvider {
  const p = (name || process.env.EXTRACTION_PROVIDER || "mock").toLowerCase();
  switch (p) {
    case "ollama":
      return new OllamaProvider();
    case "azure":
      return new AzureProvider();
    case "gemini":
      return new GeminiProvider();
    case "mock":
    default:
      return new MockProvider();
  }
}

export function activeProviderName(): ProviderName {
  const p = (process.env.EXTRACTION_PROVIDER || "mock").toLowerCase();
  if (p === "ollama" || p === "azure" || p === "gemini") return p;
  return "mock";
}
