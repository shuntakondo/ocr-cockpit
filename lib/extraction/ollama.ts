import type { ExtractionProvider, ExtractionInput } from "@/lib/extraction/types";
import { ExtractionError } from "@/lib/extraction/types";
import {
  buildExtractionData,
  EXTRACTION_JSON_INSTRUCTIONS,
  ProviderResultSchema,
} from "@/lib/extraction/schema";
import type { ExtractionData } from "@/lib/types";
import { documentToText } from "@/lib/ocr";
import { backfillFromText } from "@/lib/extraction/postprocess";

// ─────────────────────────────────────────────────────────────────────────────
// Local, free extraction via Ollama.
//   OLLAMA_MODE=vision → send the image directly to a multimodal model
//                        (e.g. llama3.2-vision, minicpm-v, llava).
//   OLLAMA_MODE=text   → OCR the document (unpdf / tesseract.js), then ask a
//                        text model (e.g. the bundled llama3.2) to structure it.
// ─────────────────────────────────────────────────────────────────────────────

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export class OllamaProvider implements ExtractionProvider {
  readonly name = "ollama" as const;

  async extract(input: ExtractionInput): Promise<ExtractionData> {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "llama3.2";
    const mode = (process.env.OLLAMA_MODE || "text").toLowerCase();

    // Validate the configured base URL before using it in a request (guards
    // against a malformed or non-http(s) OLLAMA_BASE_URL).
    let parsedBase: URL;
    try {
      parsedBase = new URL(baseUrl);
    } catch {
      throw new ExtractionError(`OLLAMA_BASE_URL is not a valid URL: ${baseUrl}`, "ollama");
    }
    if (parsedBase.protocol !== "http:" && parsedBase.protocol !== "https:") {
      throw new ExtractionError("OLLAMA_BASE_URL must use http or https.", "ollama");
    }

    let userContent: string;
    let images: string[] | undefined;
    let rawText: string | null = null;

    if (mode === "vision") {
      images = [Buffer.from(input.bytes).toString("base64")];
      userContent = `Extract the accounts-payable fields from this ${input.kind}.`;
    } else {
      rawText = await documentToText(input.bytes, input.mimeType);
      userContent = `Extract the accounts-payable fields from this ${input.kind}.\n\nDocument text:\n${rawText}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    let json: { message?: { content?: string } };
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          format: "json",
          stream: false,
          options: { temperature: 0 },
          messages: [
            { role: "system", content: EXTRACTION_JSON_INSTRUCTIONS },
            { role: "user", content: userContent, ...(images ? { images } : {}) },
          ],
        }),
      });
      if (!res.ok) {
        throw new ExtractionError(
          `Ollama returned HTTP ${res.status}. Is \`ollama serve\` running and is the model "${model}" pulled?`,
          "ollama",
        );
      }
      json = (await res.json()) as { message?: { content?: string } };
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ExtractionError(
          `Ollama request timed out after 120s (model "${model}").`,
          "ollama",
          err,
        );
      }
      throw new ExtractionError(
        `Could not reach Ollama at ${baseUrl}.`,
        "ollama",
        err,
      );
    } finally {
      clearTimeout(timeout);
    }

    const content = json.message?.content ?? "";
    const parsed = ProviderResultSchema.safeParse(safeJsonParse(content));
    if (!parsed.success) {
      throw new ExtractionError(
        "Ollama did not return a valid extraction JSON.",
        "ollama",
        parsed.error,
      );
    }
    return backfillFromText(
      buildExtractionData(parsed.data, "ollama", rawText, new Date().toISOString()),
    );
  }
}
