/**
 * Copies the ONNX Runtime WASM binaries into `public/ort/`.
 *
 * Transformers.js loads these at runtime and, left alone, fetches them from a
 * public CDN. Three reasons not to let it:
 *
 *   - `vercel.json` sets `script-src 'self'`. A CDN script is blocked outright.
 *   - It would put a third-party origin between a VA and a tool that is
 *     supposed to keep working on a locked-down laptop.
 *   - The version served would be whatever the CDN has, not the one this build
 *     was tested against.
 *
 * So they are served from our own origin, pinned to the version in the
 * lockfile. `public/ort/` is generated and gitignored — this runs as part of
 * `npm run build`, and on `postinstall` so `npm run dev` works from a fresh
 * clone without a separate step.
 *
 * Run: node scripts/vendor-ort.mjs
 */
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'node_modules/onnxruntime-web/dist');
const DEST = resolve(root, 'public/ort');

/**
 * Only the threaded SIMD builds ship.
 *
 * The runtime picks one of these four at load time by feature-detecting the
 * browser — `.jsep` for WebGPU, `.asyncify`/`.jspi` for the async variants, and
 * the plain one for baseline WASM. The rest of `dist/` is Node builds, source
 * maps and the bundler entry points, none of which the browser ever requests;
 * copying the directory wholesale would add ~90 MB to the deployment for files
 * nothing loads.
 */
const PATTERN = /^ort-wasm-simd-threaded(\.(jsep|asyncify|jspi))?\.(mjs|wasm)$/;

async function main() {
  let entries;
  try {
    entries = await readdir(SOURCE);
  } catch {
    console.error(
      `vendor-ort: ${SOURCE} not found.\n` +
      'onnxruntime-web arrives as a dependency of @huggingface/transformers — run npm install first.',
    );
    process.exit(1);
  }

  const wanted = entries.filter((name) => PATTERN.test(name));
  if (!wanted.length) {
    console.error(
      'vendor-ort: no ort-wasm-simd-threaded.* files in onnxruntime-web/dist.\n' +
      'The runtime renamed its artefacts; update PATTERN in this script to match.',
    );
    process.exit(1);
  }

  // Rebuild the directory so a stale binary from a previous onnxruntime-web
  // cannot be served alongside the current one — the loader picks by filename,
  // and a leftover would be chosen in preference to nothing.
  await rm(DEST, { recursive: true, force: true });
  await mkdir(DEST, { recursive: true });

  for (const name of wanted) {
    await copyFile(resolve(SOURCE, name), resolve(DEST, name));
  }

  console.log(`vendor-ort: ${wanted.length} files → public/ort/`);
}

await main();
