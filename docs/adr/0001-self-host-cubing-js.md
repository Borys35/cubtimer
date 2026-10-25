# Self-host cubing.js for offline scrambles

The browser loads the cubing.js scrambler from the app's own `/cubing/` copy (built by `scripts/copy-cubing.mjs`), not from `cdn.cubing.net`. The installed app has to produce real WCA random-state scrambles offline. A cross-origin CDN module and its workers can't be precached reliably by the service worker, and when the CDN fails the app falls back to random-move scrambles, which lowers scramble quality without telling the user. We give up automatic CDN updates: cubing.js changes only when the npm dependency is bumped.

## Consequences

- cubing's npm `dist/lib` imports bare specifiers a browser can't resolve, so `scripts/copy-cubing.mjs` bundles the `cubing/scramble` entry with esbuild (code-split, minified, no source maps) into `public/cubing/`. The output is about 1.2 MB, most of it the inlined WASM search.
- All of `public/cubing/` is precached when the app is installed, so every puzzle scrambles offline from the first launch.
- The random-move generators in `src/lib/scramble.ts` remain only as a last resort if the self-hosted module fails to load.
