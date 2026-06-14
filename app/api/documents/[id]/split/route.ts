import { NextRequest, NextResponse } from "next/server";
import {
  addAudit,
  createDocument,
  deleteDocument,
  getDocument,
} from "@/lib/db/repository";
import { readDocumentFile } from "@/lib/storage";
import { pdfPageCount } from "@/lib/ocr/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/documents/:id/split
// Split a multi-page PDF into one document per page. Each new document points at
// the SAME stored file but is scoped to its page (extraction + preview use that
// page only). The original "whole" document row is removed (the file is shared
// and kept). Returns the new document IDs in page order.
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (doc.mimeType !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF documents can be split." },
      { status: 400 },
    );
  }
  if (doc.page != null) {
    return NextResponse.json(
      { error: "This document is already a single page." },
      { status: 400 },
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = await readDocumentFile(doc.source, doc.filename);
  } catch {
    return NextResponse.json({ error: "Stored file not found." }, { status: 404 });
  }

  const pages = await pdfPageCount(bytes);
  if (pages <= 1) {
    return NextResponse.json(
      { error: "PDF has only one page; nothing to split." },
      { status: 400 },
    );
  }

  const base = doc.originalFilename.replace(/\.pdf$/i, "");
  const ids: string[] = [];
  for (let p = 1; p <= pages; p++) {
    const created = await createDocument({
      filename: doc.filename, // shared file
      originalFilename: `${base} — page ${p}.pdf`,
      mimeType: doc.mimeType,
      kind: doc.kind,
      source: doc.source,
      sizeBytes: doc.sizeBytes,
      page: p,
    });
    await addAudit(created.id, "uploaded", `Split from ${doc.originalFilename} (page ${p}/${pages})`);
    ids.push(created.id);
  }

  // Remove the original whole-document row (keeps the shared file on disk).
  await deleteDocument(id);

  return NextResponse.json({ ids, pages });
}
