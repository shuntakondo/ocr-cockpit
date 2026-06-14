import { chromium } from "playwright";

// Render an SVG to a real PDF (with a selectable text layer) via headless Chrome.
//   node scripts/svg-to-pdf.mjs <in.svg> <out.pdf>
const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node scripts/svg-to-pdf.mjs <in.svg> <out.pdf>");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + inPath, { waitUntil: "load" });
const dims = await page.$eval("svg", (el) => {
  const vb = el.viewBox && el.viewBox.baseVal;
  return {
    w: (vb && vb.width) || el.width.baseVal.value || 760,
    h: (vb && vb.height) || el.height.baseVal.value || 640,
  };
});
await page.pdf({
  path: outPath,
  width: dims.w + "px",
  height: dims.h + "px",
  printBackground: true,
  pageRanges: "1",
});
await browser.close();
console.log("wrote", outPath, `${dims.w}x${dims.h}`);
