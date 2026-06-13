import { notFound } from "next/navigation";
import { ReviewCockpit } from "@/components/review-cockpit";
import { getDocument, listAudit, listDocuments } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc, audit, all] = await Promise.all([
    getDocument(id),
    listAudit(id),
    listDocuments(),
  ]);

  if (!doc) notFound();

  const queueIds = all.map((d) => d.id);
  return <ReviewCockpit document={doc} audit={audit} queueIds={queueIds} />;
}
