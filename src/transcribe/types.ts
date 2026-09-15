/**
 * Transcription types.
 *
 * A transcript is a list of timestamped segments with a speaker index, plus the
 * speaker names those indices point at. Names live in one array rather than on
 * every segment so renaming "Speaker 1" to "Dr. Reyes" is a single write, not a
 * sweep over hundreds of rows.
 *
 * Times are **seconds as floats**, matching what Whisper returns. Converting to
 * milliseconds here would mean rounding twice — once on the way in and again in
 * the SRT/VTT writers — and the second rounding is the one that has to be exact.
 */

/** One utterance. `end` may equal `start` on a trailing fragment. */
export interface Segment {
  /** Stable within a transcript; used as the edit and playback key. */
  id: number;
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  text: string;
  /** Index into `Transcript.speakers`. */
  speaker: number;
}

export interface Transcript {
  id: string;
  /** The source file's name, kept so a list of transcripts is recognisable. */
  name: string;
  createdAt: number;
  durationSec: number;
  /** BCP-47-ish code Whisper reported, or `auto` when detection was left on. */
  language: string;
  /** Which tier produced this, so a re-run at a higher tier is an informed choice. */
  modelId: string;
  segments: Segment[];
  /** Display names, indexed by `Segment.speaker`. Always at least one entry. */
  speakers: string[];
}

/* ----------------------------------------------------------------- models */

export type TierId = 'fast' | 'balanced' | 'accurate';

export interface ModelTier {
  id: TierId;
  label: string;
  /** Hugging Face repo id passed to the pipeline. */
  repo: string;
  /**
   * Approximate download in megabytes, on the WebGPU path.
   *
   * Two figures because the backend decides the dtype, and the dtype decides
   * which files are fetched — the CPU path is smaller for the two small tiers
   * and much larger for the big one. One number would be wrong half the time.
   */
  megabytes: number;
  /** The same, on the WASM/CPU path, where the 8-bit weights are used. */
  megabytesCpu: number;
  /** One line on the speed/accuracy trade, in the user's terms. */
  note: string;
  /** True for English-only weights, which the picker has to disclose. */
  englishOnly: boolean;
}

/* --------------------------------------------------------------- progress */

/**
 * What the worker reports back.
 *
 * `download` covers the one-time model fetch and `transcribe` the run itself.
 * They are separate states because the first is measured in hundreds of
 * megabytes and happens once, and conflating them produces a progress bar that
 * sits at 4% for two minutes and then races — the classic way to make a working
 * tool look broken.
 */
export type Phase = 'idle' | 'download' | 'load' | 'transcribe' | 'done' | 'error';

export interface Progress {
  phase: Phase;
  /** 0–1 within the current phase, or undefined when it cannot be known. */
  ratio?: number;
  /** Human-readable detail: a file name while downloading, a timecode while running. */
  detail?: string;
}

/** Raw chunk shape returned by the ASR pipeline with `return_timestamps: true`. */
export interface RawChunk {
  /** `[start, end]`; `end` is null on the final chunk of a stream. */
  timestamp: [number, number | null];
  text: string;
}
