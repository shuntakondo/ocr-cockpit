"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Save,
  Check,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Keyboard,
  ArrowLeft,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { FieldRow } from "@/components/field-row";
import { DocumentPreview } from "@/components/document-preview";
import { ProgressBar } from "@/components/ui/progress";
import { formatMoney } from "@/lib/utils";
import {
  FIELD_SPECS,
  LOW_CONFIDENCE_THRESHOLD,
  type AuditEntry,
  type DocumentRecord,
  type ExtractionData,
  type FieldKey,
  type FieldSpec,
} from "@/lib/types";

type Val = string | number | null;

const GROUP_TITLES: Record<FieldSpec["group"], string> = {
  party: "Vendor",
  identifiers: "Identifiers",
  dates: "Dates",
  amounts: "Amounts",
  accounting: "Accounting",
};
const GROUP_ORDER: FieldSpec["group"][] = [
  "party",
  "identifiers",
  "dates",
  "amounts",
  "accounting",
];

interface ReviewCockpitProps {
  document: DocumentRecord;
  audit: AuditEntry[];
  queueIds: string[];
}

export function ReviewCockpit({
  document: initialDoc,
  audit: initialAudit,
  queueIds,
}: ReviewCockpitProps) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [extraction, setExtraction] = useState<ExtractionData | null>(
    initialDoc.extraction,
  );
  const [audit, setAudit] = useState(initialAudit);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const idx = queueIds.indexOf(doc.id);
  const prevId = idx > 0 ? queueIds[idx - 1] : null;
  const nextId = idx >= 0 && idx < queueIds.length - 1 ? queueIds[idx + 1] : null;

  const lowCount = extraction
    ? FIELD_SPECS.filter(
        (s) => extraction[s.key].confidence < LOW_CONFIDENCE_THRESHOLD,
      ).length
    : 0;

  function setField(key: FieldKey, value: Val) {
    setExtraction((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next[key] = { ...next[key], value } as never;
      return next;
    });
    setDirty(true);
  }

  async function reload() {
    const res = await fetch(`/api/documents/${doc.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setDoc(data.document);
    setExtraction(data.document.extraction);
    setAudit(data.audit);
    setDirty(false);
  }

  async function runExtract() {
    setBusy("Extracting…");
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/extract`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extraction failed.");
      } else {
        setDoc(data.document);
        setExtraction(data.document.extraction);
        setDirty(false);
      }
      await refreshAudit();
    } finally {
      setBusy(null);
    }
  }

  async function save(): Promise<DocumentRecord | null> {
    if (!extraction) return null;
    setBusy("Saving…");
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extraction }),
      });
      const data = await res.json();
      if (res.ok) {
        setDoc(data.document);
        setExtraction(data.document.extraction);
        setDirty(false);
        await refreshAudit();
        return data.document;
      }
      setError(data.error ?? "Save failed.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!extraction) return;
    setBusy("Approving…");
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extraction, status: "approved" }),
      });
      const data = await res.json();
      if (res.ok) {
        setDoc(data.document);
        setExtraction(data.document.extraction);
        setDirty(false);
        await refreshAudit();
        if (nextId) router.push(`/documents/${nextId}`);
      } else {
        setError(data.error ?? "Approve failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function refreshAudit() {
    const res = await fetch(`/api/documents/${doc.id}`);
    if (res.ok) {
      const data = await res.json();
      setAudit(data.audit);
      setDoc(data.document);
    }
  }

  function exportDoc(format: "csv" | "accounting") {
    const url = `/api/export?ids=${doc.id}&format=${format}&markExported=1`;
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "";
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => void reload(), 700);
  }

  async function remove() {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    setBusy("Deleting…");
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    router.push("/documents");
  }

  // Keyboard shortcuts (latest handlers via ref to avoid stale closures).
  const handlers = useRef({
    runExtract,
    save,
    approve,
    prevId,
    nextId,
    dirty,
    extraction,
  });
  useEffect(() => {
    handlers.current = {
      runExtract,
      save,
      approve,
      prevId,
      nextId,
      dirty,
      extraction,
    };
  });

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const el = window.document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement;
      const h = handlers.current;

      if (ev.key === "?") {
        setShowHelp((s) => !s);
        return;
      }
      if (ev.key === "Escape") {
        setShowHelp(false);
        if (typing) (el as HTMLElement).blur();
        return;
      }
      if ((ev.key === "[" || ev.key === "ArrowLeft") && !typing && h.prevId) {
        router.push(`/documents/${h.prevId}`);
        return;
      }
      if ((ev.key === "]" || ev.key === "ArrowRight") && !typing && h.nextId) {
        router.push(`/documents/${h.nextId}`);
        return;
      }
      if (typing) return;
      if (ev.key === "e") {
        ev.preventDefault();
        void h.runExtract();
      } else if (ev.key === "s") {
        ev.preventDefault();
        if (h.dirty) void h.save();
      } else if (ev.key === "a") {
        ev.preventDefault();
        if (h.extraction) void h.approve();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-2.5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/documents")}>
            <ArrowLeft size={15} /> Queue
          </Button>
          <div className="flex items-center gap-2">
            <span className="max-w-[260px] truncate text-sm font-medium">
              {extraction?.vendor.value ?? doc.originalFilename}
            </span>
            <StatusBadge status={doc.status} />
            {doc.page != null && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted">
                page {doc.page}
              </span>
            )}
            {dirty && (
              <span className="text-[11px] font-medium text-warn">
                unsaved
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            onClick={() => prevId && router.push(`/documents/${prevId}`)}
            disabled={!prevId}
            aria-label="Previous document"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-xs tabular-nums text-muted">
            {idx + 1} / {queueIds.length}
          </span>
          <Button
            variant="ghost"
            onClick={() => nextId && router.push(`/documents/${nextId}`)}
            disabled={!nextId}
            aria-label="Next document"
          >
            <ChevronRight size={16} />
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />

          {!extraction || doc.status === "error" ? (
            <Button variant="primary" onClick={runExtract} disabled={!!busy}>
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              Extract
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={runExtract} disabled={!!busy}>
                <RefreshCw size={15} /> Re-extract
              </Button>
              <Button
                variant="secondary"
                onClick={save}
                disabled={!dirty || !!busy}
              >
                <Save size={15} /> Save
              </Button>
              <Button variant="secondary" onClick={() => exportDoc("csv")}>
                <Download size={15} /> Export
              </Button>
              <Button variant="primary" onClick={approve} disabled={!!busy}>
                <Check size={15} /> Approve
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => setShowHelp((s) => !s)} aria-label="Keyboard shortcuts">
            <Keyboard size={16} />
          </Button>
          <Button variant="ghost" onClick={remove} aria-label="Delete document">
            <Trash2 size={15} />
          </Button>
        </div>
      </div>

      {busy && (
        <div className="bg-accent-soft px-5 py-2 text-xs font-medium text-accent">
          <div className="flex items-center gap-2">
            <Loader2 size={13} className="animate-spin" />
            {busy}
          </div>
          <ProgressBar className="mt-1.5" />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-danger-soft px-5 py-1.5 text-xs font-medium text-danger">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* Two-pane body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        {/* Left: preview */}
        <div className="min-h-0 overflow-hidden border-b border-border bg-surface-2 p-4 lg:border-b-0 lg:border-r">
          <div className="h-full min-h-[400px]">
            <DocumentPreviewFrame doc={doc} />
          </div>
        </div>

        {/* Right: fields */}
        <div className="min-h-0 overflow-auto bg-surface px-5 py-4">
          {!extraction ? (
            <EmptyExtraction onExtract={runExtract} busy={!!busy} />
          ) : (
            <ReviewPanel
              extraction={extraction}
              setField={setField}
              lowCount={lowCount}
              audit={audit}
            />
          )}
        </div>
      </div>

      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function DocumentPreviewFrame({ doc }: { doc: DocumentRecord }) {
  return (
    <DocumentPreview
      documentId={doc.id}
      mimeType={doc.mimeType}
      filename={doc.originalFilename}
      page={doc.page}
    />
  );
}

function EmptyExtraction({
  onExtract,
  busy,
}: {
  onExtract: () => void;
  busy: boolean;
}) {
  if (busy) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Sparkles size={32} className="mb-3 animate-pulse text-accent" />
        <h2 className="text-base font-semibold">Reading the document…</h2>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Extracting vendor, dates, amounts and line items. A local vision model
          can take up to a minute.
        </p>
        <ProgressBar className="mt-4 w-48" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Sparkles size={32} className="mb-3 text-accent" />
      <h2 className="text-base font-semibold">Not extracted yet</h2>
      <p className="mt-1 max-w-xs text-sm text-muted">
        Run extraction to pull vendor, dates, amounts and line items from this
        document, then review the results here.
      </p>
      <Button
        variant="primary"
        className="mt-4"
        onClick={onExtract}
        disabled={busy}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Sparkles size={15} />
        )}
        Extract now
      </Button>
      <p className="mt-3 text-xs text-muted">
        Shortcut: press <kbd>e</kbd>
      </p>
    </div>
  );
}

function ReviewPanel({
  extraction,
  setField,
  lowCount,
  audit,
}: {
  extraction: ExtractionData;
  setField: (key: FieldKey, value: Val) => void;
  lowCount: number;
  audit: AuditEntry[];
}) {
  const lineTotal = extraction.lineItems.reduce(
    (a, li) => a + (li.amount ?? 0),
    0,
  );

  // First low-confidence field gets autofocus for fast keyboard correction.
  const firstLowKey = FIELD_SPECS.find(
    (s) => extraction[s.key].confidence < LOW_CONFIDENCE_THRESHOLD,
  )?.key;

  return (
    <div className="space-y-5">
      {/* Summary line */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold capitalize">
            {extraction.documentKind}
          </span>
          <span className="text-muted">
            {" "}
            · {extraction.providerName} engine
          </span>
        </div>
        {lowCount > 0 && (
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
            {lowCount} field{lowCount === 1 ? "" : "s"} to review
          </span>
        )}
      </div>

      {/* Warnings */}
      {extraction.warnings.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-danger-soft p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-danger">
            <AlertTriangle size={13} /> Consistency checks
          </div>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-danger">
            {extraction.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Field groups */}
      {GROUP_ORDER.map((group) => {
        const specs = FIELD_SPECS.filter((s) => s.group === group);
        if (specs.length === 0) return null;
        return (
          <div key={group}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {GROUP_TITLES[group]}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {specs.map((spec) => {
                const f = extraction[spec.key];
                return (
                  <FieldRow
                    key={spec.key}
                    spec={spec}
                    value={f.value}
                    confidence={f.confidence}
                    providerValue={f.providerValue}
                    onChange={(v) => setField(spec.key, v)}
                    autoFocus={spec.key === firstLowKey}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Line items */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Line items
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] text-muted">
                <th scope="col" className="px-3 py-1.5 font-medium">Description</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Qty</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Unit</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {extraction.lineItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted">
                    No line items detected.
                  </td>
                </tr>
              )}
              {extraction.lineItems.map((li, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5">{li.description}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {li.quantity ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatMoney(li.unitPrice, extraction.currency.value)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatMoney(li.amount, extraction.currency.value)}
                  </td>
                </tr>
              ))}
            </tbody>
            {extraction.lineItems.length > 0 && (
              <tfoot>
                <tr className="bg-surface-2 text-sm font-medium">
                  <td className="px-3 py-1.5" colSpan={3}>
                    Line items total
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatMoney(lineTotal, extraction.currency.value)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Audit trail */}
      {audit.length > 0 && (
        <details className="rounded-lg border border-border bg-surface-2 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted">
            Audit trail ({audit.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-medium text-ink">{a.action}</span>
                  {a.detail ? ` — ${a.detail}` : ""}
                </span>
                <span className="shrink-0 tabular-nums">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["e", "Extract / re-extract"],
    ["s", "Save edits"],
    ["a", "Approve & next"],
    ["[ / →", "Previous / next document"],
    ["?", "Toggle this help"],
    ["Esc", "Close / blur field"],
  ];
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            id="shortcut-help-title"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Keyboard size={16} /> Keyboard shortcuts
          </span>
          <button
            autoFocus
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="space-y-2">
          {rows.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between text-sm">
              <span className="text-muted">{label}</span>
              <kbd>{k}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
