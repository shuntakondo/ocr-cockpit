/** Extract embedded text from a native (text-based) PDF using unpdf. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  // pdf.js rejects Node Buffers (a Uint8Array subclass) — pass a plain Uint8Array.
  const data = new Uint8Array(bytes);
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
