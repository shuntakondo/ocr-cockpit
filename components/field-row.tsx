"use client";

import { cn } from "@/lib/utils";
import { LOW_CONFIDENCE_THRESHOLD, type FieldSpec } from "@/lib/types";
import { ConfidenceBadge, confidenceTone } from "@/components/confidence-badge";

type Val = string | number | null;

interface FieldRowProps {
  spec: FieldSpec;
  value: Val;
  confidence: number;
  providerValue: Val;
  onChange: (value: Val) => void;
  autoFocus?: boolean;
}

export function FieldRow({
  spec,
  value,
  confidence,
  providerValue,
  onChange,
  autoFocus,
}: FieldRowProps) {
  const tone = confidenceTone(confidence);
  const low = confidence < LOW_CONFIDENCE_THRESHOLD;
  const changed = String(value ?? "") !== String(providerValue ?? "");

  const inputType =
    spec.type === "money" || spec.type === "number"
      ? "number"
      : spec.type === "date"
        ? "date"
        : "text";

  const handle = (raw: string) => {
    if (inputType === "number") {
      onChange(raw === "" ? null : Number(raw));
    } else {
      onChange(raw === "" ? null : raw);
    }
  };

  const accent =
    tone === "danger"
      ? "border-l-danger"
      : tone === "warn"
        ? "border-l-warn"
        : "border-l-transparent";

  return (
    <div className={cn("border-l-2 pl-3", accent)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor={`field-${spec.key}`}
          className="text-xs font-medium text-muted"
        >
          {spec.label}
          {low && (
            <span className="ml-1.5 text-[10px] font-semibold text-warn">
              · review
            </span>
          )}
        </label>
        <ConfidenceBadge confidence={confidence} />
      </div>
      <input
        id={`field-${spec.key}`}
        type={inputType}
        inputMode={inputType === "number" ? "decimal" : undefined}
        step={spec.type === "money" || spec.type === "number" ? "any" : undefined}
        autoFocus={autoFocus}
        value={value ?? ""}
        onChange={(e) => handle(e.target.value)}
        className={cn(
          "w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm tabular-nums transition",
          low ? "border-warn/40" : "border-border",
          "focus:border-accent",
        )}
      />
      {changed && (
        <p className="mt-1 text-[11px] text-accent">
          Edited · original: {providerValue == null || providerValue === "" ? "—" : String(providerValue)}
        </p>
      )}
    </div>
  );
}
