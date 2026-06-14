import { NextRequest, NextResponse } from "next/server";
import {
  addAudit,
  createDocument,
  deleteDocument,
  getDocument,
} from "@/lib/db/repository";
import { readDocumentFile } from "@/lib/storage";
import { extractPdfPages } from "@/lib/ocr/pdf";
import { detectInvoiceGroups } from "@/lib/extraction/segment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/documents/:id/autosplit
// Auto-detect invoice boundaries in a multi-page PDF and split into one document
// per invoice (each scoped to its page range). If only one invoice is detected,
// the document is left untouched (covers all pages). No user prompt.
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Only whole-file PDFs are segmentable.
  if (doc.mimeType !== "application/pdf" || doc.page != null) {
    return NextResponse.json({ groups: 1, ids: [id] });
  }

  let bytes: Uint8Array;
  try {
    bytes = await readDocumentFile(doc.source, doc.filename);
  } catch {
    return NextResponse.json({ error: "Stored file not found." }, { status: 404 });
  }

  let pageTexts: string[];
  try {
    pageTexts = await extractPdfPages(bytes);
  } catch {
    return NextResponse.json({ groups: 1, ids: [id] });
  }

  const groups = detectInvoiceGroups(pageTexts);
  if (groups.length <= 1) {
    // Single invoice (possibly multi-page) — keep the whole-file document.
    return NextResponse.json({ groups: 1, ids: [id] });
  }

  const base = doc.originalFilename.replace(/\.pdf$/i, "");
  const ids: string[] = [];
  for (const g of groups) {
    const range = g.end > g.start ? `pages ${g.start}–${g.end}` : `page ${g.start}`;
    const created = await createDocument({
      filename: doc.filename, // shared file
      originalFilename: `${base} — ${range}.pdf`,
      mimeType: doc.mimeType,
      kind: doc.kind,
      source: doc.source,
      sizeBytes: doc.sizeBytes,
      page: g.start,
      pageEnd: g.end > g.start ? g.end : null,
    });
    await addAudit(
      created.id,
      "uploaded",
      `Auto-detected invoice from ${doc.originalFilename} (${range})`,
    );
    ids.push(created.id);
  }

  // Remove the original whole-file row (keeps the shared file on disk).
  await deleteDocument(id);

  return NextResponse.json({ groups: groups.length, ids });
}
