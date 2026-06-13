/**
 * OCR a raster image (PNG/JPEG/TIFF) with tesseract.js. Language data is
 * downloaded on first use; set OCR_LANG (e.g. "eng+jpn") to control it.
 */
export async function ocrImage(bytes: Uint8Array): Promise<string> {
  const lang = process.env.OCR_LANG || "eng";
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(Buffer.from(bytes));
    return data.text;
  } finally {
    await worker.terminate();
  }
}
