/**
 * The main thread's side of the worker.
 *
 * One job: turn a file plus a tier into a `Transcript`, reporting progress on
 * the way, and be interruptible. Everything model-shaped stays behind this
 * boundary so the UI never imports Transformers.js and never sees a tensor.
 */
import { decodeAudioFile } from './audio.js';
import { toSegments, defaultSpeakerNames } from './segments.js';
import { tierById } from './models.js';
import type { Progress, RawChunk, TierId, Transcript } from './types.js';

export interface RunOptions {
  file: File;
  tier: TierId;
  /** A `LANGUAGES` code, or `auto` to let the model detect it. */
  language: string;
  onProgress: (progress: Progress) => void;
}

type WorkerMessage =
  | { type: 'progress'; phase: 'download' | 'load' | 'transcribe'; ratio?: number; detail?: string }
  | { type: 'result'; chunks: RawChunk[]; text: string; device: string }
  | { type: 'error'; message: string };

export class TranscribeCancelled extends Error {
  constructor() { super('Transcription stopped.'); }
}

/**
 * The worker, kept alive between runs.
 *
 * It has to outlive a single run, because the model lives inside it. The worker
 * caches the loaded pipeline across messages; terminating it after every file
 * threw that away and made a second transcription pay the whole start-up cost
 * again — re-reading hundreds of megabytes of weights out of Cache Storage and
 * rebuilding the inference session, several seconds before any audio is looked
 * at. A VA working through a morning of calls pays that on every one.
 *
 * The trade is that a stopped run costs a reload, since terminating is still
 * the only way to interrupt the decode loop. That is the right way round: stops
 * are rare, second files are not.
 */
let shared: Worker | null = null;

function getWorker(): Worker {
  shared ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return shared;
}

/** Kill the worker and the model with it. The next run rebuilds both. */
function disposeWorker(): void {
  shared?.terminate();
  shared = null;
}

/**
 * A run in flight.
 *
 * `stop()` terminates the worker. The pipeline exposes no abort, so this is the
 * only way to end a run that is already inside the decode loop — and it has to
 * be possible, because "I picked the wrong file" happens on minute one of a
 * forty-minute job.
 */
export class TranscribeRun {
  private stopped = false;
  private active = false;

  constructor(private readonly options: RunOptions) {}

  stop(): void {
    this.stopped = true;
    this.active = false;
    disposeWorker();
  }

  get running(): boolean {
    return this.active;
  }

  async start(): Promise<Transcript> {
    const { file, tier, language, onProgress } = this.options;

    this.active = true;
    try {
      onProgress({ phase: 'load', detail: 'Reading the audio' });
      const { samples, durationSec } = await decodeAudioFile(file);
      if (this.stopped) throw new TranscribeCancelled();

      const worker = getWorker();
      let onMessage!: (event: MessageEvent<WorkerMessage>) => void;
      let onError!: (event: ErrorEvent) => void;

      try {
        const { chunks } = await new Promise<{ chunks: RawChunk[] }>((resolve, reject) => {
          onMessage = (event) => {
            const message = event.data;
            if (message.type === 'progress') {
              onProgress({ phase: message.phase, ratio: message.ratio, detail: message.detail });
            } else if (message.type === 'result') {
              resolve({ chunks: message.chunks });
            } else {
              reject(new Error(message.message));
            }
          };

          // A worker that dies mid-run — out of memory on a large model, or a
          // WebGPU device lost — fires `error` and never resolves. Without this
          // the UI would sit on a progress bar forever.
          onError = (event) => {
            // Its state is unknown after a crash, so it does not get reused.
            disposeWorker();
            reject(new Error(event.message || 'The transcriber stopped unexpectedly.'));
          };

          worker.addEventListener('message', onMessage);
          worker.addEventListener('error', onError);

          // The samples are transferred, not copied. An hour of 16 kHz audio is
          // ~230 MB of Float32; copying it would briefly double that.
          worker.postMessage(
            { type: 'run', tier, samples, language, durationSec },
            [samples.buffer],
          );
        });

        if (this.stopped) throw new TranscribeCancelled();

        const segments = toSegments(chunks, durationSec);
        onProgress({ phase: 'done' });

        return {
          id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          createdAt: Date.now(),
          durationSec,
          language,
          modelId: tierById(tier).repo,
          segments,
          speakers: defaultSpeakerNames(segments),
        };
      } finally {
        // Detach this run's listeners but leave the worker running. Without
        // this every run would add another pair and an eighth file would report
        // its progress eight times.
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      }
    } catch (error) {
      if (this.stopped) throw new TranscribeCancelled();
      throw error;
    } finally {
      this.active = false;
    }
  }
}

/**
 * Drop the loaded model.
 *
 * For the UI to call when the tool is plainly finished with — the weights are
 * hundreds of megabytes of resident memory, and holding them for a tab that has
 * gone back to writing emails is rude on a shared laptop.
 */
export function releaseTranscriber(): void {
  disposeWorker();
}

/**
 * Whether the fast path is available.
 *
 * Used only to set expectations in the UI before a run — on WASM a long
 * recording takes minutes rather than seconds, and someone should be told that
 * before they start rather than while they wait.
 */
export async function webGpuAvailable(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}
