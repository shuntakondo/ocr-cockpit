import fs from "node:fs/promises";
import path from "node:path";
import type { DocumentSource } from "@/lib/types";

// Files live under ./storage. Samples are committed; uploads are gitignored.
const ROOT = path.join(process.cwd(), "storage");
export const UPLOAD_DIR = path.join(ROOT, "uploads");
export const SAMPLE_DIR = path.join(ROOT, "samples");

export function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function saveUpload(
  filename: string,
  bytes: Uint8Array,
): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, sanitizeFilename(filename)), bytes);
}

function dirFor(source: DocumentSource): string {
  return source === "sample" ? SAMPLE_DIR : UPLOAD_DIR;
}

/** Read a stored file. `filename` is reduced to its basename to block traversal. */
export async function readDocumentFile(
  source: DocumentSource,
  filename: string,
): Promise<Uint8Array> {
  const safe = path.basename(filename);
  const full = path.join(dirFor(source), safe);
  return fs.readFile(full);
}

export async function deleteUpload(filename: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(filename)));
  } catch {
    // already gone — ignore
  }
}

export function contentTypeFor(filename: string, fallback: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
  };
  return map[ext] ?? fallback;
}
