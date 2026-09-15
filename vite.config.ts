import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Honour PORT so tooling that assigns a free port is respected; Vite ignores it
// by default and would otherwise sit on 5173 regardless.
const port = process.env.PORT ? Number(process.env.PORT) : 5173;

/**
 * Keep the ONNX Runtime WASM out of the bundle.
 *
 * onnxruntime-web ships two browser entry points. The default one inlines its
 * WASM loader, which contains `new URL("….wasm", import.meta.url)` — Vite reads
 * that as an asset import and emits a hashed 23 MB copy into `assets/`. That
 * copy is never fetched, because the transcription worker points
 * `env.backends.onnx.wasm.wasmPaths` at `/ort/`; it is pure deployment weight,
 * and it doubled `dist/` to 100 MB.
 *
 * The `onnxruntime-web-use-extern-wasm` export condition selects the other
 * entry point, which loads the same binaries from `wasmPaths` at runtime and
 * references none of them at build time. This is the package's own supported
 * switch for exactly this situation.
 *
 * `scripts/vendor-ort.mjs` is what puts the binaries in `public/ort/`. The two
 * have to stay in step: change the path here and that script's destination has
 * to move with it.
 */
const ORT_CONDITIONS = [
  'onnxruntime-web-use-extern-wasm',
  // Vite's own defaults, which naming any condition replaces rather than adds to.
  'module',
  'browser',
  'development|production',
];

/**
 * Serve `/ort/` verbatim in dev.
 *
 * The runtime reaches its WASM loader with a dynamic `import()`. In a
 * production build that is a plain static file request and `public/ort/` serves
 * it. The dev server does not: it routes anything imported from JavaScript
 * through the transform pipeline, and refuses files under `public/` there —
 *
 *   "This file is in /public and will be copied as-is during build without
 *    going through the plugin transforms, and therefore should not be imported
 *    from source code."
 *
 * which surfaces as `no available backend found` and a failed dynamic import,
 * naming neither `public/` nor the real cause. So dev gets the same bytes by a
 * different route. The files stay in one place; only the way they are served
 * differs, and only while developing.
 */
function serveOrtInDev(): Plugin {
  const dir = resolve(import.meta.dirname, 'public/ort');
  const types: Record<string, string> = { mjs: 'text/javascript', wasm: 'application/wasm' };

  return {
    name: 'serve-ort-in-dev',
    apply: 'serve',
    configureServer(server) {
      // Registered here rather than in the returned callback so it runs *before*
      // Vite's own middlewares get to add `?import` and reject the request.
      server.middlewares.use((req, res, next) => {
        const raw = (req.url ?? '').split('?')[0];
        if (!raw.startsWith('/ort/')) return next();

        // Decode before resolving. A percent-encoded `..` reaches here as
        // literal `%2e%2e`, which `resolve` would treat as a directory name —
        // so a check against the undecoded path proves nothing.
        let path: string;
        try {
          path = decodeURIComponent(raw);
        } catch {
          return next();
        }

        const file = resolve(dir, path.slice('/ort/'.length));
        if (file !== dir && !file.startsWith(dir + sep)) return next();

        void stat(file).then(
          () => {
            res.setHeader('Content-Type', types[file.split('.').pop() ?? ''] ?? 'application/octet-stream');
            createReadStream(file).pipe(res);
          },
          // Missing means vendor-ort has not run; Vite's own 404 says so more
          // usefully than an empty response would.
          () => next(),
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [serveOrtInDev()],
  resolve: { conditions: ORT_CONDITIONS },
  optimizeDeps: { esbuildOptions: { conditions: ORT_CONDITIONS } },
  server: { port, strictPort: false },
  preview: { port },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
