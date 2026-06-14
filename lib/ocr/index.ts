import { extractPdfText } from "@/lib/ocr/pdf";
import { ocrImage } from "@/lib/ocr/image";

/** Crude text extraction from an SVG (our sample format) by pulling text nodes. */
function extractSvgText(bytes: Uint8Array): string {
  const xml = new TextDecoder().decode(bytes);
  const matches = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g) ?? [];
  return matches
    .map((m) => m.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Turn an arbitrary document into plain text for an LLM extractor.
 * - native PDF  → embedded text (unpdf)
 * - image/*     → tesseract.js OCR
 * - svg         → text nodes (sample documents)
 */
export async function documentToText(
  bytes: Uint8Array,
  mimeType: string,
  page?: number | null,
  pageEnd?: number | null,
): Promise<string> {
  if (mimeType === "application/pdf") {
    // Digital PDFs carry exact embedded text. A page range (from a split
    // document) limits extraction to those pages. (Scanned PDFs with no text
    // layer need page rasterization, which tesseract can't do on PDF bytes —
    // that path is a known gap; convert such PDFs to an image for now.)
    return extractPdfText(bytes, page ?? undefined, pageEnd ?? undefined);
  }
  if (mimeType === "image/svg+xml") {
    return extractSvgText(bytes);
  }
  if (mimeType.startsWith("image/")) {
    return ocrImage(bytes);
  }
  // Unknown: best-effort decode.
  return new TextDecoder().decode(bytes);
}
