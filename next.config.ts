import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages ship native/WASM assets and must not be bundled by Turbopack/webpack;
  // they are resolved from node_modules at runtime inside Node route handlers.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "tesseract.js",
    "pg",
    "unpdf",
    "sharp",
  ],
};

export default nextConfig;
