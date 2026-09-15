/**
 * The model catalogue.
 *
 * Three tiers, the same shape as the native tools this borrows from: pick a
 * point on the speed/accuracy line once, then forget about it.
 *
 * The megabyte figures are **measured**, not estimated — they are the sum of
 * the encoder and merged-decoder ONNX files actually fetched at the dtypes in
 * `DTYPES` below, read from the Hugging Face file listing. A tier picker that
 * under-quotes the download is worse than one that shows no number, because the
 * user finds out by watching a progress bar stall past where they expected it
 * to finish.
 *
 * There are two figures per tier because the backend picks the dtype. The
 * ordering even reverses: on CPU the small tiers are a third of the size and
 * the weight format is different, so one figure would be misleading.
 *
 * Weights come from Hugging Face on first use and are then served from the
 * browser's cache. That one fetch is the only network request this tool makes,
 * and it carries no audio, no transcript, and no identifier — it is a static
 * file download. See `doc/prd.md` §3.2.
 */
import type { ModelTier, TierId } from './types.js';

export const TIERS: ModelTier[] = [
  {
    id: 'fast',
    label: 'Fast',
    repo: 'Xenova/whisper-tiny',
    megabytes: 114,
    megabytesCpu: 39,
    note: 'Quickest, and enough for a clear one-to-one call. Expect to fix names and numbers.',
    englishOnly: false,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    repo: 'onnx-community/whisper-base',
    megabytes: 197,
    megabytesCpu: 73,
    note: 'The default. Handles accents and phone-line audio noticeably better than Fast.',
    englishOnly: false,
  },
  {
    id: 'accurate',
    label: 'Accurate',
    repo: 'onnx-community/whisper-small',
    megabytes: 300,
    megabytesCpu: 250,
    note: 'Best practical accuracy for names, crosstalk and accents without the very large model load.',
    englishOnly: false,
  },
];

export const DEFAULT_TIER: TierId = 'balanced';

export function isTierId(value: unknown): value is TierId {
  return typeof value === 'string' && TIERS.some((tier) => tier.id === value);
}

export function normalizeTier(value: unknown, fallback: TierId = DEFAULT_TIER): TierId {
  return isTierId(value) ? value : fallback;
}

export function tierById(id: string): ModelTier {
  return TIERS.find((t) => t.id === id) ?? TIERS.find((t) => t.id === DEFAULT_TIER)!;
}

/**
 * Per-tier dtype, split by module.
 *
 * A full-precision encoder with a 4-bit decoder is the combination the
 * Transformers.js Whisper examples ship, and it is chosen for a reason: the
 * encoder runs once per 30-second window and is where accuracy is won, while
 * the decoder runs once per *token* and is where the time goes. Quantising the
 * cheap half to save 50 MB costs accuracy across the whole transcript.
 *
 * The `accurate` tier quantises the encoder too. It uses Whisper Small rather
 * than the former Large Turbo model, keeping the quality step meaningful while
 * making the first load practical on ordinary laptops.
 */
export const DTYPES: Record<TierId, Record<string, string>> = {
  fast: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  balanced: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  accurate: { encoder_model: 'q4', decoder_model_merged: 'q4' },
};

/**
 * Fallback dtype when WebGPU is missing and the model runs on WASM.
 *
 * 4-bit weights are a WebGPU optimisation; on the WASM backend they are
 * dequantised on the fly and end up both slower and larger in memory than
 * 8-bit. `q8` is the right answer on CPU even though it is the worse one on GPU.
 */
export const WASM_DTYPE = 'q8';

/**
 * Languages worth listing explicitly.
 *
 * Auto-detection is the default and is usually right, but it is decided from
 * the first window alone — which on a call that opens with "Hi, thanks for
 * holding" will pick English and then mistranscribe the rest. A VA who knows
 * the call was in Tagalog should be able to say so.
 *
 * The list is short on purpose: the languages a US practice's front desk
 * actually runs on, plus the ones its VAs speak. Whisper supports many more,
 * and a longer list here would be a worse control, not a better one.
 */
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'auto', label: 'Detect automatically' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'zh', label: 'Chinese' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
