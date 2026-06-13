import fs from "node:fs/promises";
import path from "node:path";
import { getProvider } from "@/lib/extraction";
import { contentTypeFor } from "@/lib/storage";

// Dev harness: run a real extraction provider against a file and print the
// structured result + timing. Bypasses the DB/HTTP to isolate the core pipeline.
//   tsx scripts/try-extract.ts <file> [provider]
//   EXTRACTION_PROVIDER=ollama OLLAMA_MODE=text tsx scripts/try-extract.ts <file>
async function main() {
  const file = process.argv[2];
  const provider = process.argv[3] || process.env.EXTRACTION_PROVIDER || "ollama";
  if (!file) {
    console.error("usage: tsx scripts/try-extract.ts <file> [provider]");
    process.exit(1);
  }

  const bytes = new Uint8Array(await fs.readFile(file));
  const mimeType = contentTypeFor(file, "application/octet-stream");

  console.log(`provider=${provider}  mime=${mimeType}  file=${path.basename(file)}`);
  const t0 = Date.now();
  const r = await getProvider(provider).extract({
    bytes,
    mimeType,
    filename: path.basename(file),
    kind: "invoice",
  });
  const ms = Date.now() - t0;

  console.log(`elapsed=${(ms / 1000).toFixed(1)}s\n`);
  if (r.rawText) {
    console.log("--- OCR / source text (first 700 chars) ---");
    console.log(r.rawText.slice(0, 700));
    console.log("--- extracted ---");
  }
  console.log(
    JSON.stringify(
      {
        vendor: r.vendor.value,
        invoiceNumber: r.invoiceNumber.value,
        issueDate: r.issueDate.value,
        dueDate: r.dueDate.value,
        currency: r.currency.value,
        subtotal: r.subtotal.value,
        taxAmount: r.taxAmount.value,
        total: r.total.value,
        lineItems: r.lineItems,
        warnings: r.warnings,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
