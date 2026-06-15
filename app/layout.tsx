import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { activeProviderName } from "@/lib/extraction";
import "./globals.css";

export const metadata: Metadata = {
  title: "OCR Cockpit — Invoice & Receipt Data Capture",
  description:
    "Extract, review, correct and export invoice & receipt data with field-level confidence.",
};

const PROVIDER_LABEL: Record<string, string> = {
  mock: "Mock (demo)",
  ollama: "Ollama (local)",
  azure: "Azure Document Intelligence",
  gemini: "Gemini (Google)",
  groq: "Groq (Llama 4)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const provider = activeProviderName();
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-5 backdrop-blur">
          <Link href="/documents" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
              <ScanLine size={18} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              OCR Cockpit
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="hidden sm:inline">Extraction engine</span>
            <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-medium text-ink">
              {PROVIDER_LABEL[provider] ?? provider}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full">{children}</main>
      </body>
    </html>
  );
}
