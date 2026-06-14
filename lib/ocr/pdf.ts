/**
 * Extract embedded text from a native (text-based) PDF using unpdf.
 * Pass a 1-based `start` (and optional `end`) to extract only that page range
 * (used for documents split out of a multi-page PDF); omit to merge all pages.
 */
export async function extractPdfText(
  bytes: Uint8Array,
  start?: number,
  end?: number,
): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  // pdf.js rejects Node Buffers (a Uint8Array subclass) — pass a plain Uint8Array.
  const data = new Uint8Array(bytes);
  const pdf = await getDocumentProxy(data);
  if (start && start >= 1) {
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    const last = end && end >= start ? end : start;
    return pages.slice(start - 1, last).join("\n");
  }
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

/** Per-page text of a PDF (used for invoice-boundary detection). */
export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

/** Number of pages in a PDF. */
export async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  return pdf.numPages;
}
