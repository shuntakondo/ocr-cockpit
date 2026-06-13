import { cn } from "@/lib/utils";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/types";

export type ConfidenceTone = "ok" | "warn" | "danger";

export function confidenceTone(confidence: number): ConfidenceTone {
  if (confidence >= 0.9) return "ok";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "warn";
  return "danger";
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tone = confidenceTone(confidence);
  const cls =
    tone === "ok"
      ? "bg-ok-soft text-ok"
      : tone === "warn"
        ? "bg-warn-soft text-warn"
        : "bg-danger-soft text-danger";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        cls,
      )}
      title={`Model confidence: ${(confidence * 100).toFixed(0)}%`}
    >
      {Math.round(confidence * 100)}%
    </span>
  );
}
