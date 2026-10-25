// Builds the self-hosted cubing.js scrambler into public/cubing (ADR 0001).
//
// cubing's npm `dist/lib` is meant for bundlers: it imports bare specifiers
// (`random-uint-below`, `cubing/alg`, ...) that a browser can't resolve, so it
// can't be served as-is. We bundle the `cubing/scramble` entry with esbuild,
// keeping code splitting so each puzzle's solver and the search worker load
// lazily as same-origin chunks. cubing.js locates its worker relative to
// `import.meta.url`, so the worker and its chunks are served from here too.
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(process.cwd(), "node_modules/cubing/dist/lib/cubing");
const destDir = path.resolve(process.cwd(), "public/cubing");

if (!fs.existsSync(srcDir)) {
  console.warn("cubing.js not found in node_modules, skipping bundle.");
  process.exit(0);
}

fs.rmSync(destDir, { recursive: true, force: true });

await build({
  entryPoints: {
    "scramble/index": path.join(srcDir, "scramble/index.js"),
    // The worker instantiator lands in a shared chunk and first tries
    // `import.meta.resolve("./search-worker-entry.js")`; emitting the worker
    // entry under chunks/ makes that resolve, with no 404 fallback attempts.
    "chunks/search-worker-entry": path.join(srcDir, "chunks/search-worker-entry.js"),
  },
  outdir: destDir,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  chunkNames: "chunks/[name]-[hash]",
  logLevel: "warning",
});

console.log("Bundled cubing.js scrambler into public/cubing");
