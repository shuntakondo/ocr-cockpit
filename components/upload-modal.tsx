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

type ItemStatus = "uploading" | "done" | "error";
interface UploadItem {
  name: string;
  status: ItemStatus;
  error?: string;
}

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

const ACCEPT = "application/pdf,image/*";

export function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Reset and focus the drop zone whenever the modal opens.
  useEffect(() => {
    if (open) {
      setItems([]);
      setDragActive(false);
      setBusy(false);
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
    onUploaded();
    // Close automatically only if everything succeeded; otherwise keep the
    // errors visible so the user can see what was rejected.
    if (!anyError) onClose();
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

        {/* Drop zone — a div (buttons are flaky file-drop targets), made
            keyboard-accessible with role/tabIndex. Inner content is
            pointer-events-none so drag events always target the zone itself
            (avoids dragenter/leave flicker over children). */}
        <div
          ref={dropRef}
          role="button"
          tabIndex={0}
          aria-label="Drag and drop files here, or activate to browse"
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
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
          <div className="pointer-events-none flex flex-col items-center gap-2">
            <UploadCloud
              size={28}
              className={dragActive ? "text-accent" : "text-muted"}
            />
            <span className="text-sm font-medium text-ink">
              Drag &amp; drop invoices or receipts here
            </span>
            <span className="text-xs text-muted">
              or click to browse — PDF, PNG, JPG (max 15 MB each)
            </span>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Per-file progress / results */}
        {items.length > 0 && (
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
