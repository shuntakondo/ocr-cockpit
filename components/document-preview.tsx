"use client";

interface DocumentPreviewProps {
  documentId: string;
  mimeType: string;
  filename: string;
  page?: number | null;
}

export function DocumentPreview({
  documentId,
  mimeType,
  filename,
  page,
}: DocumentPreviewProps) {
  const src = `/api/documents/${documentId}/file`;

  if (mimeType === "application/pdf") {
    // Open at the document's page (split multi-page PDFs share one file).
    const pdfSrc = page ? `${src}#page=${page}` : src;
    return (
      <iframe
        src={pdfSrc}
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
