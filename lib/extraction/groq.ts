import type { ExtractionProvider, ExtractionInput } from "@/lib/extraction/types";
import { ExtractionError } from "@/lib/extraction/types";
import {
  buildExtractionData,
  EXTRACTION_JSON_INSTRUCTIONS,
  ProviderResultSchema,
} from "@/lib/extraction/schema";
import type { ExtractionData } from "@/lib/types";
import { documentToText } from "@/lib/ocr";
import { downscaleForVision } from "@/lib/extraction/image-prep";
import { backfillFromText } from "@/lib/extraction/postprocess";

// ─────────────────────────────────────────────────────────────────────────────
// Groq (free tier via an API key). Very fast inference on an OpenAI-compatible
// chat API. The default model — Llama 4 Scout — is multimodal, so images go
// straight to the vision path. Groq does NOT ingest PDFs natively, so PDFs (and
// split page-ranges) go through OCR/text first, then get structured by the model.
// Get a free key (no card) at https://console.groq.com/keys
// ─────────────────────────────────────────────────────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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

type GroqContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export class GroqProvider implements ExtractionProvider {
  readonly name = "groq" as const;

  async extract(input: ExtractionInput): Promise<ExtractionData> {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      throw new ExtractionError(
        "Groq is not configured. Set GROQ_API_KEY (free key, no card, at https://console.groq.com/keys).",
        "groq",
      );
    }
    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

    let userContent: GroqContent;
    let rawText: string | null = null;

    // Groq has no native PDF ingestion. PDFs and split page-ranges carry exact
    // embedded text — extract it and let the model structure it. Images / SVG go
    // to the multimodal vision path (rasterized + downscaled to stay small/fast).
    const isPdf = input.mimeType === "application/pdf";
    if (isPdf || input.page != null) {
      rawText = await documentToText(input.bytes, input.mimeType, input.page, input.pageEnd);
      // With little/no source text the model will fabricate a plausible invoice.
      // Refuse clearly instead.
      if (rawText.replace(/\s+/g, "").length < 15) {
        throw new ExtractionError(
          "No machine-readable text found — this looks like a scanned/image PDF. Convert it to an image, or use a provider that reads PDFs natively (gemini).",
          "groq",
        );
      }
      userContent = `Extract the accounts-payable fields from this ${input.kind}.\n\nDocument text:\n${rawText}`;
    } else {
      const prepared = await downscaleForVision(input.bytes, input.mimeType);
      const dataUrl = `data:${prepared.mimeType};base64,${Buffer.from(prepared.bytes).toString("base64")}`;
      userContent = [
        { type: "text", text: `Extract the accounts-payable fields from this ${input.kind}.` },
        { type: "image_url", image_url: { url: dataUrl } },
      ];
    }

    const controller = new AbortController();
    const timeoutMs = Number(process.env.GROQ_TIMEOUT_MS) || 60_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let json: {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: EXTRACTION_JSON_INSTRUCTIONS },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ExtractionError(
          `Groq returned HTTP ${res.status}. ${detail.slice(0, 300)}`,
          "groq",
        );
      }
      json = await res.json();
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ExtractionError(
          `Groq request timed out after ${Math.round(timeoutMs / 1000)}s.`,
          "groq",
          err,
        );
      }
      throw new ExtractionError("Could not reach Groq.", "groq", err);
    } finally {
      clearTimeout(timeout);
    }

    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = ProviderResultSchema.safeParse(safeJsonParse(content));
    if (!parsed.success) {
      throw new ExtractionError(
        "Groq did not return a valid extraction JSON.",
        "groq",
        parsed.error,
      );
    }
    return backfillFromText(
      buildExtractionData(parsed.data, "groq", rawText, new Date().toISOString()),
    );
  }
}
