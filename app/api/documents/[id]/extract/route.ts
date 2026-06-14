import { NextRequest, NextResponse } from "next/server";
import {
  addAudit,
  getDocument,
  getVendorRule,
  updateDocument,
} from "@/lib/db/repository";
import { readDocumentFile } from "@/lib/storage";
import { getProvider, activeProviderName } from "@/lib/extraction";
import { applyVendorRule } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/documents/:id/extract  → run the active provider, store the result
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Allow overriding the provider per-request (?provider=mock|ollama|azure).
  const override = req.nextUrl.searchParams.get("provider") || undefined;
  const provider = getProvider(override);

  await updateDocument(id, { status: "processing" });

  let bytes: Uint8Array;
  try {
    bytes = await readDocumentFile(doc.source, doc.filename);
  } catch {
    await updateDocument(id, { status: "error" });
    return NextResponse.json(
      { error: "Stored file could not be read." },
      { status: 500 },
    );
  }

  try {
    let extraction = await provider.extract({
      bytes,
      mimeType: doc.mimeType,
      filename: doc.originalFilename,
      kind: doc.kind,
      page: doc.page,
    });

    // Re-apply a previously confirmed rule for this vendor, if any.
    if (extraction.vendor.value) {
      const rule = await getVendorRule(extraction.vendor.value);
      if (rule) extraction = applyVendorRule(extraction, rule);
    }

    const updated = await updateDocument(id, {
      extraction,
      status: "needs_review",
    });
    await addAudit(
      id,
      "extracted",
      `Extracted via ${override ?? activeProviderName()} provider`,
    );
    return NextResponse.json({ document: updated });
  } catch (err) {
    await updateDocument(id, { status: "error" });
    const message =
      err instanceof Error ? err.message : "Extraction failed unexpectedly.";
    await addAudit(id, "error", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
