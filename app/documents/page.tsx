import { QueueView } from "@/components/queue-view";
import { countByStatus, listDocuments } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const [documents, counts] = await Promise.all([
    listDocuments(),
    countByStatus(),
  ]);
  return <QueueView initialDocuments={documents} initialCounts={counts} />;
}
