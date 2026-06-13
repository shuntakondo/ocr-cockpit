import { NextRequest, NextResponse } from "next/server";
import {
  countByStatus,
  createDocument,
  listDocuments,
  addAudit,
} from "@/lib/db/repository";
import { saveUpload, contentTypeFor, sanitizeFilename } from "@/lib/storage";
import type { DocumentKind, DocumentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/documents?status=needs_review  → list + status counts
export async function GET(req: NextRequest) {
  const statusParam = req.nextUrl.searchParams.get("status") as
    | DocumentStatus
    | null;
  const [documents, counts] = await Promise.all([
    listDocuments(statusParam ? { status: statusParam } : undefined),
    countByStatus(),
  ]);
  return NextResponse.json({ documents, counts });
}

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/tiff",
]);

// POST /api/documents  (multipart) → upload a new document
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file'." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 15 MB." }, { status: 413 });
  }

  const kind = (form.get("kind") as DocumentKind) || "invoice";
  const original = sanitizeFilename(file.name || "upload");
  const mimeType = file.type || contentTypeFor(original, "application/octet-stream");

  // Allowlist by resolved type — reject anything that is not a supported
  // document/image format.
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Upload a PDF or image.` },
      { status: 415 },
    );
  }

  const storageName = `${crypto.randomUUID()}-${original}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  await saveUpload(storageName, bytes);
  const doc = await createDocument({
    filename: storageName,
    originalFilename: original,
    mimeType,
    kind: kind === "receipt" ? "receipt" : "invoice",
    source: "upload",
    sizeBytes: bytes.length,
  });
  await addAudit(doc.id, "uploaded", `Uploaded ${original}`);

  return NextResponse.json({ document: doc }, { status: 201 });
}
