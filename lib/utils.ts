import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as a currency-ish amount for display. */
export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value == null) return "—";
  const code = (currency || "JPY").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "JPY" ? 0 : 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${code}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}
