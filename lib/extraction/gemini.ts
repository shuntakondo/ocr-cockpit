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
// Google Gemini (free tier via an AI Studio API key). Fast and multimodal: it
// reads a whole PDF directly — digital OR scanned — and images, so it's the
// quick option when local extraction is too slow. Split page-range documents go
// through the text path (Gemini reads the whole PDF, so we feed only the range's
// text). Get a free key at https://aistudio.google.com/app/apikey
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

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export class GeminiProvider implements ExtractionProvider {
  readonly name = "gemini" as const;

  async extract(input: ExtractionInput): Promise<ExtractionData> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new ExtractionError(
        "Gemini is not configured. Set GEMINI_API_KEY (free key at https://aistudio.google.com/app/apikey).",
        "gemini",
      );
    }
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const parts: GeminiPart[] = [{ text: EXTRACTION_JSON_INSTRUCTIONS }];
    let rawText: string | null = null;

    if (input.page != null) {
      // A split page-range: Gemini reads the whole PDF, so feed only this range's text.
      rawText = await documentToText(input.bytes, input.mimeType, input.page, input.pageEnd);
      if (rawText.replace(/\s+/g, "").length < 15) {
        throw new ExtractionError(
          "No machine-readable text found for this page range.",
          "gemini",
        );
      }
      parts.push({ text: `Document text:\n${rawText}` });
    } else if (input.mimeType === "application/pdf") {
      // Gemini ingests PDFs natively (digital and scanned).
      parts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: Buffer.from(input.bytes).toString("base64"),
        },
      });
    } else {
      // Image or SVG → rasterize/downscale to PNG, then send as an image.
      const prepared = await downscaleForVision(input.bytes, input.mimeType);
      parts.push({
        inline_data: {
          mime_type: prepared.mimeType,
          data: Buffer.from(prepared.bytes).toString("base64"),
        },
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const controller = new AbortController();
    const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 60_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let json: {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ExtractionError(
          `Gemini returned HTTP ${res.status}. ${detail.slice(0, 300)}`,
          "gemini",
        );
      }
      json = await res.json();
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ExtractionError(
          `Gemini request timed out after ${Math.round(timeoutMs / 1000)}s.`,
          "gemini",
          err,
        );
      }
      throw new ExtractionError("Could not reach Gemini.", "gemini", err);
    } finally {
      clearTimeout(timeout);
    }

    const content =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = ProviderResultSchema.safeParse(safeJsonParse(content));
    if (!parsed.success) {
      throw new ExtractionError(
        "Gemini did not return a valid extraction JSON.",
        "gemini",
        parsed.error,
      );
    }
    return backfillFromText(
      buildExtractionData(parsed.data, "gemini", rawText, new Date().toISOString()),
    );
  }
}
