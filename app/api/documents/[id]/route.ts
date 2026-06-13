import { NextRequest, NextResponse } from "next/server";
import {
  addAudit,
  deleteDocument,
  getDocument,
  listAudit,
  updateDocument,
  upsertVendorRule,
} from "@/lib/db/repository";
import { deleteUpload } from "@/lib/storage";
import { normalizeExtraction } from "@/lib/service";
import type { DocumentStatus, ExtractionData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/documents/:id  → document + audit trail
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const audit = await listAudit(id);
  return NextResponse.json({ document: doc, audit });
}

interface PatchBody {
  extraction?: ExtractionData;
  status?: DocumentStatus;
  notes?: string | null;
}

// PATCH /api/documents/:id  → save edited fields, change status, add notes
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const existing = await getDocument(id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const patch: {
    extraction?: ExtractionData;
    status?: DocumentStatus;
    notes?: string | null;
  } = {};

  if (body.extraction) {
    // Recompute edited-flags + warnings from the submitted values.
    patch.extraction = normalizeExtraction(body.extraction);
    const editedCount = Object.values(patch.extraction).filter(
      (v) => typeof v === "object" && v !== null && "edited" in v && v.edited,
    ).length;
    await addAudit(id, "field_edited", `${editedCount} field(s) corrected`);
  }
  if (body.status) patch.status = body.status;
  if (body.notes !== undefined) patch.notes = body.notes;

  const updated = await updateDocument(id, patch);

  // On approval, learn this vendor's account code + tax rate for next time.
  if (body.status === "approved" && updated?.extraction) {
    const e = updated.extraction;
    if (e.vendor.value) {
      await upsertVendorRule(
        e.vendor.value,
        e.accountCode.value,
        e.taxRate.value,
      );
    }
    await addAudit(id, "approved", "Fields confirmed");
  }
  if (body.status === "exported") {
    await addAudit(id, "exported", "Included in an export");
  }

  return NextResponse.json({ document: updated });
}

// DELETE /api/documents/:id
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (doc.source === "upload") await deleteUpload(doc.filename);
  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}
