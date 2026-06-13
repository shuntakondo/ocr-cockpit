import { cn } from "@/lib/utils";
import { statusLabel, type DocumentStatus } from "@/lib/types";

const styles: Record<DocumentStatus, string> = {
  uploaded: "bg-surface-2 text-muted border-border",
  processing: "bg-accent-soft text-accent border-accent/30",
  needs_review: "bg-warn-soft text-warn border-warn/30",
  approved: "bg-ok-soft text-ok border-ok/30",
  exported: "bg-accent-soft text-accent border-accent/30",
  error: "bg-danger-soft text-danger border-danger/30",
};

export function StatusBadge({
  status,
  className,
}: {
  status: DocumentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles[status],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
