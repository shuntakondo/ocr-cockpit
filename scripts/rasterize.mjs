import { chromium } from "playwright";

// Rasterize an SVG to PNG (real pixels for OCR testing): tsx not needed.
//   node scripts/rasterize.mjs <in.svg> <out.png>
const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node scripts/rasterize.mjs <in.svg> <out.png>");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto("file://" + inPath, { waitUntil: "load" });
await page.waitForTimeout(200);
const el = (await page.$("svg")) || page;
await el.screenshot({ path: outPath });
await browser.close();
console.log("wrote", outPath);
