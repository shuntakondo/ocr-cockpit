"use client";

import { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Loader2,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type ItemStatus = "uploading" | "done" | "error";
interface UploadItem {
  name: string;
  status: ItemStatus;
  error?: string;
}

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after uploads finish, with the IDs of the documents created. */
  onUploaded: (uploadedIds: string[]) => void;
}

const ACCEPT = "application/pdf,image/*";

export function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingSplit, setPendingSplit] = useState<{
    id: string;
    name: string;
    pageCount: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Reset and focus the drop zone whenever the modal opens.
  useEffect(() => {
    if (open) {
      setItems([]);
      setDragActive(false);
      setBusy(false);
      setPendingSplit(null);
      const t = setTimeout(() => dropRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function handleFiles(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    setItems(files.map((f) => ({ name: f.name, status: "uploading" as const })));
    setBusy(true);
    let anyError = false;
    const results: { id: string; pageCount: number }[] = [];

    await Promise.all(
      files.map(async (file, i) => {
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/documents", { method: "POST", body: form });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
          }
          const data = await res.json().catch(() => null);
          if (data?.document?.id) {
            results.push({ id: data.document.id, pageCount: data.pageCount ?? 1 });
          }
          setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: "done" } : it)),
          );
        } catch (err) {
          anyError = true;
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: "error",
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : it,
            ),
          );
        }
      }),
    );

    setBusy(false);

    // A single multi-page PDF → ask whether each page is a separate invoice.
    if (files.length === 1 && results.length === 1 && results[0].pageCount > 1) {
      setPendingSplit({
        id: results[0].id,
        name: files[0].name,
        pageCount: results[0].pageCount,
      });
      return; // keep the modal open for the choice
    }

    onUploaded(results.map((r) => r.id));
    // Close automatically only if everything succeeded; otherwise keep the
    // errors visible so the user can see what was rejected.
    if (!anyError) onClose();
  }

  async function splitPending() {
    if (!pendingSplit) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${pendingSplit.id}/split`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      const ids: string[] = Array.isArray(data.ids) ? data.ids : [];
      onUploaded(ids.length ? ids : [pendingSplit.id]);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function keepPendingAsOne() {
    if (!pendingSplit) return;
    onUploaded([pendingSplit.id]);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      onClick={() => !busy && onClose()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2
            id="upload-modal-title"
            className="text-sm font-semibold"
          >
            Upload documents
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close upload dialog"
            className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {pendingSplit && (
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-center">
            <FileText size={22} className="mx-auto mb-2 text-accent" />
            <p className="truncate text-sm font-medium text-ink">
              {pendingSplit.name}
            </p>
            <p className="mt-1 text-sm text-muted">
              This PDF has {pendingSplit.pageCount} pages. Is each page a separate
              invoice?
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="secondary"
                onClick={keepPendingAsOne}
                disabled={busy}
              >
                Keep as one
              </Button>
              <Button variant="primary" onClick={splitPending} disabled={busy}>
                Split into {pendingSplit.pageCount} documents
              </Button>
            </div>
            {busy && <ProgressBar className="mt-3" />}
          </div>
        )}

        {/* Drop zone — a div (buttons are flaky file-drop targets), made
            keyboard-accessible with role/tabIndex. Inner content is
            pointer-events-none so drag events always target the zone itself
            (avoids dragenter/leave flicker over children). */}
        {!pendingSplit && (
        <div
          ref={dropRef}
          role="button"
          tabIndex={0}
          aria-label="Drag and drop files here, or activate to browse"
          aria-busy={busy}
          onClick={() => !busy && fileInput.current?.click()}
          onKeyDown={(e) => {
            if (!busy && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
            dragActive
              ? "border-accent bg-accent-soft"
              : "border-border bg-surface-2 hover:bg-accent-soft/40",
          )}
        >
          <div className="pointer-events-none flex w-full flex-col items-center gap-2">
            <UploadCloud
              size={28}
              className={cn(
                busy
                  ? "animate-pulse text-accent"
                  : dragActive
                    ? "text-accent"
                    : "text-muted",
              )}
            />
            {busy ? (
              <>
                <span className="text-sm font-medium text-ink">
                  Importing {items.length} file{items.length === 1 ? "" : "s"}…
                </span>
                <ProgressBar className="mt-1 w-2/3" />
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-ink">
                  Drag &amp; drop invoices or receipts here
                </span>
                <span className="text-xs text-muted">
                  or click to browse — PDF, PNG, JPG (max 15 MB each)
                </span>
              </>
            )}
          </div>
        </div>
        )}

        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Per-file progress / results */}
        {!pendingSplit && items.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {items.map((it, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs"
              >
                {it.status === "uploading" && (
                  <Loader2 size={14} className="animate-spin text-accent" />
                )}
                {it.status === "done" && <Check size={14} className="text-ok" />}
                {it.status === "error" && (
                  <AlertTriangle size={14} className="text-danger" />
                )}
                <FileText size={13} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-ink">{it.name}</span>
                {it.status === "error" && (
                  <span className="shrink-0 text-danger">{it.error}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
