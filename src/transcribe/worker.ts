/**
 * The transcription worker.
 *
 * Whisper decoding is a long, synchronous, CPU- or GPU-bound loop. Run on the
 * main thread it freezes the page for the length of the audio — no progress
 * bar, no cancel button, and a browser "page unresponsive" prompt part way
 * through. So it runs here, and the main thread only ever handles messages.
 *
 * The other reason for the boundary is narrower and more useful: a worker can
 * be **terminated**. The pipeline has no cancel, so "Stop" kills the worker
 * outright. That is not a graceful abort, and it is the only one available.
 * The model weights survive it — they live in the browser's Cache Storage, not
 * in this worker — so restarting after a stop re-reads from disk rather than
 * re-downloading.
 */
/**
 * `@huggingface/transformers` is pinned to an exact 3.8.1 in package.json, not
 * a caret range. On 4.x every Whisper model fails to open a session on the CPU
 * backend:
 *
 *     Can't create a session. ERROR_CODE: 1, ERROR_MESSAGE: qdq_actions.cc:137
 *     TransposeDQWeightsForMatMulNBits Missing required scale:
 *     model.decoder.embed_tokens.weight_merged_0_scale
 *
 * It reproduces with the library's own default configuration — every model
 * (tiny, base, small), every dtype including fp32, every graph
 * optimization level, with the WASM binaries vendored or fetched from the
 * library's own CDN. Nothing in this repository triggers it and nothing here
 * can work around it. Before widening that pin, transcribe a file on a machine
 * with no WebGPU adapter and confirm it still runs.
 */
import {
  pipeline, env, WhisperTextStreamer,
  type AutomaticSpeechRecognitionPipeline,
} from '@huggingface/transformers';
import { DTYPES, WASM_DTYPE, tierById } from './models.js';
import type { RawChunk, TierId } from './types.js';

/**
 * Serve the ONNX runtime's WASM from our own origin.
 *
 * Transformers.js defaults to a public CDN for these. That would mean a second
 * third-party origin in the CSP and a hard dependency on someone else's uptime
 * for a tool whose whole claim is that it runs locally. `scripts/vendor-ort.mjs`
 * copies them into `public/ort/` at build time instead.
 */
const wasmBackend = env.backends.onnx.wasm;
if (wasmBackend) wasmBackend.wasmPaths = '/ort/';

/**
 * Use extra WASM threads when the host has opted into the isolation headers
 * they require; otherwise stay on one thread so the template studio's
 * cross-origin images keep working. WebGPU remains the preferred fast path.
 */
if (wasmBackend) {
  const runtime = globalThis as typeof globalThis & { crossOriginIsolated?: boolean };
  const canUseThreads = runtime.crossOriginIsolated === true &&
    typeof SharedArrayBuffer !== 'undefined';
  const threadCount = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1));
  wasmBackend.numThreads = canUseThreads ? threadCount : 1;
}

/** Models are fetched from the Hub; there is no local model directory to check. */
env.allowLocalModels = false;

type Incoming =
  | { type: 'run'; tier: TierId; samples: Float32Array; language: string; durationSec: number };

type Outgoing =
  | { type: 'progress'; phase: 'download' | 'load' | 'transcribe'; ratio?: number; detail?: string }
  | { type: 'result'; chunks: RawChunk[]; text: string; device: string }
  | { type: 'error'; message: string };

type ModelProgressEvent = {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

const post = (message: Outgoing): void => { self.postMessage(message); };

/**
 * Overlap is the practical speed/accuracy dial for chunked Whisper. Fast uses
 * less overlap to finish sooner; Balanced and Accurate get the standard 5-second
 * context at each boundary without repeating more audio than necessary.
 */
function strideFor(tier: TierId): number {
  return tier === 'fast' ? 3 : 5;
}

function shortFileName(file: string | undefined): string | undefined {
  if (!file) return undefined;
  return file.split('/').pop() || file;
}

function aggregateDownloadProgress(files: Map<string, { loaded: number; total: number }>): number | undefined {
  const entries = [...files.values()].filter((file) => file.total > 0);
  if (!entries.length) return undefined;
  const loaded = entries.reduce((sum, file) => sum + Math.min(file.loaded, file.total), 0);
  const total = entries.reduce((sum, file) => sum + file.total, 0);
  return total ? Math.min(1, loaded / total) : undefined;
}

/** `12:04` — where in the recording the decoder currently is. */
function formatOffset(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * A narrowed view of `pipeline`.
 *
 * Its published signature is an overload set across every task the library
 * supports; asking TypeScript to resolve it for one call produces
 * "union type that is too complex to represent". We only ever build one kind of
 * pipeline, so the task and the return type are fixed here and the compiler is
 * given something it can check the rest of this file against.
 */
const buildPipeline = pipeline as unknown as (
  task: 'automatic-speech-recognition',
  model: string,
  options: Record<string, unknown>,
) => Promise<AutomaticSpeechRecognitionPipeline>;

/** Cached across runs so a second file does not reload the weights. */
let loaded: { tier: TierId; device: string; pipe: AutomaticSpeechRecognitionPipeline } | null = null;

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

async function load(tier: TierId): Promise<{ pipe: AutomaticSpeechRecognitionPipeline; device: string }> {
  if (loaded?.tier === tier) return { pipe: loaded.pipe, device: loaded.device };

  const model = tierById(tier);
  const webgpu = await hasWebGpu();
  const device = webgpu ? 'webgpu' : 'wasm';

  // 4-bit weights are a WebGPU format; on CPU they are dequantised per
  // inference and end up slower than 8-bit. See models.ts.
  const dtype = webgpu ? DTYPES[tier] : WASM_DTYPE;
  const downloadFiles = new Map<string, { loaded: number; total: number }>();

  const pipe = await buildPipeline('automatic-speech-recognition', model.repo, {
    device,
    dtype,
    progress_callback: (event: ModelProgressEvent) => {
      if (event.status === 'progress' && typeof event.progress === 'number') {
        if (event.file && typeof event.loaded === 'number' && typeof event.total === 'number') {
          downloadFiles.set(event.file, { loaded: event.loaded, total: event.total });
        }
        post({
          type: 'progress',
          phase: 'download',
          ratio: aggregateDownloadProgress(downloadFiles) ?? event.progress / 100,
          detail: shortFileName(event.file),
        });
      } else if (event.status === 'download' || event.status === 'initiate') {
        post({ type: 'progress', phase: 'download', detail: shortFileName(event.file) });
      } else if (event.status === 'ready' || event.status === 'done') {
        post({ type: 'progress', phase: 'load' });
      }
    },
  });

  loaded = { tier, device, pipe };
  return { pipe, device };
}

self.addEventListener('message', (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type !== 'run') return;

  void (async () => {
    try {
      post({ type: 'progress', phase: 'load' });
      const { pipe, device } = await load(message.tier);

      post({ type: 'progress', phase: 'transcribe', ratio: 0 });

      /**
       * Progress comes from the streamer, not from a timer.
       *
       * `on_chunk_start` fires with the offset in seconds of each 30-second
       * window as decoding reaches it, so the bar tracks position in the audio
       * — the one quantity that actually maps to how much work is left. A bar
       * driven by elapsed time would run at a different speed on every machine
       * and lie on all of them.
       */
      // The pipeline's `tokenizer` is typed as the base class; for an ASR
      // pipeline built on Whisper it is always the Whisper subclass, which is
      // what the streamer needs in order to read timestamp tokens.
      const streamer = new WhisperTextStreamer(pipe.tokenizer as never, {
        on_chunk_start: (offset: number) => {
          post({
            type: 'progress',
            phase: 'transcribe',
            ratio: message.durationSec ? Math.min(1, offset / message.durationSec) : undefined,
            detail: formatOffset(offset),
          });
        },
      });

      const output = await pipe(message.samples, {
        // Whisper sees 30 seconds at a time. Tier-specific overlap keeps the
        // fast path responsive while giving the larger models more context at
        // boundaries where names and clinical terms are easiest to lose.
        chunk_length_s: 30,
        stride_length_s: strideFor(message.tier),
        return_timestamps: true,
        // `auto` means "say nothing and let the model detect it" — passing the
        // literal string would make it try to transcribe into a language called
        // "auto" and return nothing useful.
        language: message.language === 'auto' ? undefined : message.language,
        task: 'transcribe',
        streamer,
      } as Record<string, unknown>);

      const result = Array.isArray(output) ? output[0] : output;
      post({
        type: 'result',
        chunks: (result?.chunks ?? []) as RawChunk[],
        text: String(result?.text ?? ''),
        device,
      });
    } catch (error) {
      post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  })();
});
