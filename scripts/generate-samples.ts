import fs from "node:fs/promises";
import path from "node:path";
import { SAMPLE_DOCS } from "@/lib/samples/data";
import { generateSvg } from "@/lib/samples/generate";

// Writes the fictional sample invoices/receipts to storage/samples as SVG.
async function main() {
  const dir = path.join(process.cwd(), "storage", "samples");
  await fs.mkdir(dir, { recursive: true });
  for (const doc of SAMPLE_DOCS) {
    await fs.writeFile(path.join(dir, doc.filename), generateSvg(doc), "utf8");
    console.log("wrote", doc.filename);
  }
  console.log(`Generated ${SAMPLE_DOCS.length} sample documents in ${dir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
