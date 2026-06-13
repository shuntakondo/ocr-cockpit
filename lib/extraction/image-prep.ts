// Prepare an image for a vision model: rasterize SVG, honor EXIF rotation, and
// downscale to a maximum dimension. Real uploads (phone photos, scans) are huge,
// and a vision model's token count scales with resolution — without this, a 4000px
// photo produces an enormous prompt and times out. Returns PNG bytes.

export async function downscaleForVision(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const max = Number(process.env.OLLAMA_MAX_IMAGE_PX) || 1000;
  const isSvg = mimeType === "image/svg+xml";
  const isRaster = mimeType.startsWith("image/") && !isSvg;

  // Vision can't consume PDFs directly (use OLLAMA_MODE=text for those).
  if (!isSvg && !isRaster) return { bytes, mimeType };

  const { default: sharp } = await import("sharp");
  const pipeline = isSvg
    ? sharp(Buffer.from(bytes), { density: 144 }) // rasterize vectors crisply
    : sharp(Buffer.from(bytes)).rotate(); // apply EXIF orientation
  const out = await pipeline
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return { bytes: new Uint8Array(out), mimeType: "image/png" };
}
