/**
 * Extract embedded text from a native (text-based) PDF using unpdf.
 * Pass a 1-based `page` to extract only that page (used for split documents);
 * omit it to merge all pages.
 */
export async function extractPdfText(
  bytes: Uint8Array,
  page?: number,
): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  // pdf.js rejects Node Buffers (a Uint8Array subclass) — pass a plain Uint8Array.
  const data = new Uint8Array(bytes);
  const pdf = await getDocumentProxy(data);
  if (page && page >= 1) {
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    return pages[page - 1] ?? "";
  }
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

/** Number of pages in a PDF. */
export async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  return pdf.numPages;
}
