import { NextRequest, NextResponse } from "next/server";
import {
  addAudit,
  getDocument,
  listDocuments,
  updateDocument,
} from "@/lib/db/repository";
import { documentsToCsv } from "@/lib/export/csv";
import { documentsToAccountingCsv } from "@/lib/export/accounting";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/export?format=csv|accounting&status=approved&ids=a,b&markExported=1
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") === "accounting" ? "accounting" : "csv";
  const idsParam = params.get("ids");
  const statusParam = params.get("status") as DocumentStatus | null;
  const markExported = params.get("markExported") === "1";

  let docs: DocumentRecord[];
  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean);
    const found = await Promise.all(ids.map((id) => getDocument(id)));
    docs = found.filter((d): d is DocumentRecord => d !== null);
  } else {
    docs = await listDocuments(statusParam ? { status: statusParam } : undefined);
  }

  // Only export documents that have been extracted.
  docs = docs.filter((d) => d.extraction !== null);

  const body =
    format === "accounting"
      ? documentsToAccountingCsv(docs)
      : documentsToCsv(docs);

  if (markExported) {
    await Promise.all(
      docs
        .filter((d) => d.status === "approved")
        .map(async (d) => {
          await updateDocument(d.id, { status: "exported" });
          await addAudit(d.id, "exported", `Exported as ${format} CSV`);
        }),
    );
  }

  const filename = `ocr-cockpit-${format}-${docs.length}-docs.csv`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
