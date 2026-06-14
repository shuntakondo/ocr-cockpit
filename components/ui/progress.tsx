import { cn } from "@/lib/utils";

/** Indeterminate progress bar for opaque "working" states (upload, extraction). */
export function ProgressBar({ className }: { className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label="Working"
      className={cn(
        "ocr-progress h-1 w-full rounded-full bg-border",
        className,
      )}
    >
      <span />
    </div>
  );
}
