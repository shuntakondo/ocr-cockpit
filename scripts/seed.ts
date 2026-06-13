import fs from "node:fs/promises";
import path from "node:path";
import { SAMPLE_DOCS } from "@/lib/samples/data";
import { generateSvg } from "@/lib/samples/generate";
import { getDb } from "@/lib/db";
import { addAudit, createDocument, updateDocument } from "@/lib/db/repository";
import { getProvider } from "@/lib/extraction";

// Resets the database and loads the sample documents into a realistic mix of
// states: a few still "uploaded" (to demo extraction live), most already
// extracted and "needs_review", and a couple "approved". Seeding always uses
// the deterministic mock provider so the demo content is stable.
//
// Run this with the dev server stopped (PGlite is single-process).
async function main() {
  const dir = path.join(process.cwd(), "storage", "samples");
  await fs.mkdir(dir, { recursive: true });

  const db = await getDb();
  await db.query("DELETE FROM audit_log");
  await db.query("DELETE FROM documents");

  const provider = getProvider("mock");
  let i = 0;

  for (const sample of SAMPLE_DOCS) {
    const svg = generateSvg(sample);
    await fs.writeFile(path.join(dir, sample.filename), svg, "utf8");
    const bytes = new TextEncoder().encode(svg);

    const doc = await createDocument({
      filename: sample.filename,
      originalFilename: sample.filename,
      mimeType: "image/svg+xml",
      kind: sample.kind,
      source: "sample",
      sizeBytes: bytes.length,
    });
    await addAudit(doc.id, "uploaded", "Seeded sample document");

    // Leave the first 3 unextracted so the demo can run extraction live.
    if (i >= 3) {
      const extraction = await provider.extract({
        bytes,
        mimeType: "image/svg+xml",
        filename: sample.filename,
        kind: sample.kind,
      });
      await updateDocument(doc.id, { extraction, status: "needs_review" });
      await addAudit(doc.id, "extracted", "Extracted via mock provider");

      // Approve a couple to show the downstream states.
      if (i === 5 || i === 9) {
        await updateDocument(doc.id, { status: "approved" });
        await addAudit(doc.id, "approved", "Confirmed during seed");
      }
    }
    i++;
  }

  console.log(`Seeded ${SAMPLE_DOCS.length} documents (3 uploaded, rest reviewed).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
