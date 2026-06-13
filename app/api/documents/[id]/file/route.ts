import { NextRequest, NextResponse } from "next/server";
import { getDocument } from "@/lib/db/repository";
import { readDocumentFile, contentTypeFor } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/documents/:id/file  → serve the stored document for the preview pane
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let bytes: Uint8Array;
  try {
    bytes = await readDocumentFile(doc.source, doc.filename);
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const contentType = contentTypeFor(doc.filename, doc.mimeType);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      // Harden against any active content in user-supplied SVG/HTML: deny
      // everything, allow only inline styles (needed to render SVG), sandbox it.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  });
}
