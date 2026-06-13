"use client";

interface DocumentPreviewProps {
  documentId: string;
  mimeType: string;
  filename: string;
}

export function DocumentPreview({
  documentId,
  mimeType,
  filename,
}: DocumentPreviewProps) {
  const src = `/api/documents/${documentId}/file`;

  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={src}
        title={filename}
        className="h-full w-full rounded-lg border border-border bg-white"
      />
    );
  }

  // Images and SVG render in an <img> (no script execution); the file route
  // also serves them under a strict CSP.
  return (
    <div className="flex h-full w-full items-start justify-center overflow-auto rounded-lg border border-border bg-white p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={filename} className="max-w-full" />
    </div>
  );
}
