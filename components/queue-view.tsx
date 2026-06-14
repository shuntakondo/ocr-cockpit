"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, AlertTriangle, FileText, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { UploadModal } from "@/components/upload-modal";
import { cn, formatMoney } from "@/lib/utils";
import {
  DOCUMENT_STATUSES,
  FIELD_SPECS,
  LOW_CONFIDENCE_THRESHOLD,
  statusLabel,
  type DocumentRecord,
  type DocumentStatus,
} from "@/lib/types";

function lowConfidenceCount(doc: DocumentRecord): number {
  if (!doc.extraction) return 0;
  return FIELD_SPECS.filter(
    (s) => doc.extraction![s.key].confidence < LOW_CONFIDENCE_THRESHOLD,
  ).length;
}

// An anchor styled like a secondary button — keeps proper link semantics for
// file downloads (avoids a <button> nested inside an <a>).
const LINK_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-surface-2";

interface QueueViewProps {
  initialDocuments: DocumentRecord[];
  initialCounts: Record<string, number>;
}

export function QueueView({ initialDocuments, initialCounts }: QueueViewProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState<DocumentStatus | "all">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [, startTransition] = useTransition();

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  async function refresh(next: DocumentStatus | "all" = filter) {
    const qs = next === "all" ? "" : `?status=${next}`;
    const res = await fetch(`/api/documents${qs}`);
    const data = await res.json();
    setDocuments(data.documents);
    setCounts(data.counts);
  }

  function selectFilter(next: DocumentStatus | "all") {
    setFilter(next);
    startTransition(() => {
      void refresh(next);
    });
  }

  function handleUploaded() {
    setFilter("all");
    void refresh("all");
  }

  const exportHref = (format: "csv" | "accounting") => {
    const status = filter === "all" ? "" : `&status=${filter}`;
    return `/api/export?format=${format}${status}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Document queue
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {total} document{total === 1 ? "" : "s"} · extract, review and export
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={exportHref("csv")}
            className={LINK_BUTTON}
            aria-label="Export current view as CSV"
          >
            <Download size={15} /> CSV
          </a>
          <a
            href={exportHref("accounting")}
            className={LINK_BUTTON}
            aria-label="Export current view as accounting CSV"
          >
            <Download size={15} /> Accounting CSV
          </a>
          <Button
            variant="primary"
            onClick={() => setUploadOpen(true)}
            aria-label="Upload documents (PDF or image)"
          >
            <Upload size={15} />
            Upload
          </Button>
        </div>
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />

      {/* Status filter tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterTab
          label="All"
          count={total}
          active={filter === "all"}
          onClick={() => selectFilter("all")}
        />
        {DOCUMENT_STATUSES.map((s) => (
          <FilterTab
            key={s}
            label={statusLabel(s)}
            count={counts[s] ?? 0}
            active={filter === s}
            onClick={() => selectFilter(s)}
          />
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Vendor</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Invoice No.</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Issue date</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-muted">
                  <Inbox size={28} className="mx-auto mb-2 opacity-40" />
                  No documents here yet. Upload an invoice or receipt to begin.
                </td>
              </tr>
            )}
            {documents.map((doc) => {
              const e = doc.extraction;
              const low = lowConfidenceCount(doc);
              const warnings = e?.warnings.length ?? 0;
              return (
                <tr
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Review ${e?.vendor.value ?? doc.originalFilename}`}
                  onClick={() => router.push(`/documents/${doc.id}`)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      router.push(`/documents/${doc.id}`);
                    }
                  }}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {e?.vendor.value ?? (
                      <span className="flex items-center gap-1.5 text-muted">
                        <FileText size={14} />
                        {doc.originalFilename}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {e?.invoiceNumber.value ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {e?.issueDate.value ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e
                      ? formatMoney(e.total.value, e.currency.value)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(low > 0 || warnings > 0) && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          warnings > 0
                            ? "bg-danger-soft text-danger"
                            : "bg-warn-soft text-warn",
                        )}
                      >
                        <AlertTriangle size={12} />
                        {warnings > 0
                          ? `${warnings} issue${warnings === 1 ? "" : "s"}`
                          : `${low} to review`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-muted hover:bg-surface-2",
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
