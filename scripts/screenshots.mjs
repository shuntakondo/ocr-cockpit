import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

// Captures the cockpit screenshots used in the README.
// Requires the app to be running (npm run start) at BASE_URL.
const BASE = process.env.BASE_URL || "http://localhost:3030";
const OUT = "docs/screenshots";

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1512, height: 945 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1) Document queue
  await page.goto(`${BASE}/documents`, { waitUntil: "load" });
  await page.waitForSelector("table tbody tr");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/queue.png`, fullPage: true });
  console.log("wrote queue.png");

  // 2) Review cockpit — pick a "needs review" document
  const id = await page.evaluate(async () => {
    const r = await fetch("/api/documents?status=needs_review");
    const j = await r.json();
    return j.documents[0]?.id;
  });
  if (!id) throw new Error("No needs_review document found — run `npm run db:seed` first.");

  await page.goto(`${BASE}/documents/${id}`, { waitUntil: "load" });
  await page.waitForSelector("img, iframe");
  await page.waitForTimeout(900); // let the SVG preview paint
  await page.screenshot({ path: `${OUT}/review.png` });
  console.log("wrote review.png");

  // 3) Keyboard shortcuts overlay
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  await page.keyboard.press("Shift+Slash"); // "?"
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/shortcuts.png` });
  console.log("wrote shortcuts.png");

  await browser.close();
  console.log(`Done → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
