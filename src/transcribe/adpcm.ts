/**
 * ADPCM, the compression that hides inside a .wav.
 *
 * A WAV file is a container, not a format, and the two ADPCM variants below are
 * what dictation hardware, voice recorders and phone systems put in it when
 * they want a file a quarter the size of PCM. Browsers do not decode either
 * one: Chrome, Firefox and Safari all reject them, so the file plays in VLC and
 * in Windows Media Player and nowhere on the web. It arrives here as a .wav
 * that every tool the user owns can open, which makes "convert it to WAV" the
 * least helpful thing an error message could say.
 *
 * Both are 4 bits per sample and block-based: a block opens with the exact
 * state of the decoder — the last sample, the current step size — and then
 * spends one nibble per sample describing the difference from a prediction.
 * That per-block reset is what makes a truncated recording still readable, and
 * why decoding is a loop over blocks rather than over samples.
 *
 * The tables are the ones in the IMA and Microsoft specifications; the arrays
 * are not derived from anything, they are the standard.
 */

/** `wFormatTag` values, as they appear in a `fmt ` chunk. */
export const IMA_ADPCM = 0x0011;
export const MS_ADPCM = 0x0002;

/** How far the step index moves after each nibble, by nibble value. */
const IMA_INDEX_DELTA = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

/** The 89 quantiser step sizes, growing roughly exponentially. */
const IMA_STEPS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
  50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230,
  253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
  1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327,
  3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442,
  11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794,
  32767,
];

/** Microsoft's default predictor pairs. A file may carry its own instead. */
const MS_COEFFICIENTS: Array<[number, number]> = [
  [256, 0], [512, -256], [0, 0], [192, 64], [240, 0], [460, -208], [392, -232],
];

/** How the delta scales after each nibble, by nibble value. */
const MS_ADAPT = [
  230, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230, 230,
];

const SAMPLE_MIN = -32768;
const SAMPLE_MAX = 32767;

function clampSample(value: number): number {
  if (value < SAMPLE_MIN) return SAMPLE_MIN;
  if (value > SAMPLE_MAX) return SAMPLE_MAX;
  return value;
}

export interface AdpcmSpec {
  channels: number;
  /** Bytes per block — the unit the whole format is addressed in. */
  blockAlign: number;
  /**
   * Frames each block expands to. The header declares it, but the value is
   * implied by `blockAlign`, so a file that omits or fumbles it is still
   * readable.
   */
  samplesPerBlock: number;
  /** Present only for MS ADPCM, and only when the file overrides the defaults. */
  coefficients?: Array<[number, number]>;
}

/** Frames a block holds, derived from its size. Used when the header is silent. */
export function imaSamplesPerBlock(blockAlign: number, channels: number): number {
  return 1 + Math.floor(((blockAlign - 4 * channels) * 2) / channels);
}

export function msSamplesPerBlock(blockAlign: number, channels: number): number {
  return 2 + Math.floor(((blockAlign - 7 * channels) * 2) / channels);
}

/**
 * Decode one nibble of IMA, advancing the channel's predictor and step index.
 *
 * The reconstruction is deliberately written as shifts and adds rather than
 * arithmetic: it is a bit-exact specification, and a version using
 * multiplication rounds differently and drifts audibly over a long recording.
 */
function imaNibble(
  nibble: number,
  channel: number,
  predictors: Int32Array,
  indices: Int32Array,
): number {
  const step = IMA_STEPS[indices[channel]];

  let diff = step >> 3;
  if (nibble & 1) diff += step >> 2;
  if (nibble & 2) diff += step >> 1;
  if (nibble & 4) diff += step;

  const predicted = clampSample(predictors[channel] + (nibble & 8 ? -diff : diff));
  predictors[channel] = predicted;

  const index = indices[channel] + IMA_INDEX_DELTA[nibble];
  indices[channel] = index < 0 ? 0 : index > 88 ? 88 : index;

  return predicted;
}

/**
 * IMA/DVI ADPCM (format 0x11) → float samples per channel.
 *
 * Stereo interleaves in groups of four bytes — eight nibbles for the left, then
 * eight for the right — rather than per sample, which is the detail most
 * hand-written decoders get wrong.
 */
export function decodeIma(
  view: DataView,
  start: number,
  size: number,
  spec: AdpcmSpec,
): { channels: Float32Array[]; length: number } {
  const { channels, blockAlign, samplesPerBlock } = spec;
  const headerBytes = 4 * channels;

  const out = allocate(size, spec, headerBytes);
  const predictors = new Int32Array(channels);
  const indices = new Int32Array(channels);
  let written = 0;

  for (let blockStart = start; blockStart + headerBytes <= start + size; blockStart += blockAlign) {
    const blockEnd = Math.min(blockStart + blockAlign, start + size);

    for (let c = 0; c < channels; c += 1) {
      const at = blockStart + c * 4;
      predictors[c] = view.getInt16(at, true);
      const index = view.getUint8(at + 2);
      indices[c] = index > 88 ? 88 : index;
      out[c][written] = predictors[c] / 32768;
    }

    // The block header's sample is the block's first sample, not a preamble.
    let inBlock = 1;
    let at = blockStart + headerBytes;

    while (inBlock < samplesPerBlock && at + 4 * channels <= blockEnd) {
      for (let c = 0; c < channels; c += 1) {
        for (let b = 0; b < 4; b += 1) {
          const byte = view.getUint8(at + c * 4 + b);
          const first = inBlock + b * 2;

          // Low nibble is the earlier sample.
          if (first < samplesPerBlock) {
            out[c][written + first] = imaNibble(byte & 0x0f, c, predictors, indices) / 32768;
          }
          if (first + 1 < samplesPerBlock) {
            out[c][written + first + 1] = imaNibble(byte >> 4, c, predictors, indices) / 32768;
          }
        }
      }

      inBlock += 8;
      at += 4 * channels;
    }

    written += Math.min(inBlock, samplesPerBlock);
  }

  return trim(out, written);
}

/**
 * Microsoft ADPCM (format 0x02) → float samples per channel.
 *
 * Where IMA tracks a step size, this predicts each sample from the previous two
 * with a pair of coefficients chosen per block, then codes the residual. Nibbles
 * run high first and alternate channels one at a time.
 */
export function decodeMs(
  view: DataView,
  start: number,
  size: number,
  spec: AdpcmSpec,
): { channels: Float32Array[]; length: number } {
  const { channels, blockAlign, samplesPerBlock } = spec;
  const table = spec.coefficients?.length ? spec.coefficients : MS_COEFFICIENTS;
  const headerBytes = 7 * channels;

  const out = allocate(size, spec, headerBytes);
  const coeff1 = new Int32Array(channels);
  const coeff2 = new Int32Array(channels);
  const delta = new Int32Array(channels);
  const sample1 = new Int32Array(channels);
  const sample2 = new Int32Array(channels);
  let written = 0;

  for (let blockStart = start; blockStart + headerBytes <= start + size; blockStart += blockAlign) {
    const blockEnd = Math.min(blockStart + blockAlign, start + size);

    // The header stores each field for every channel before moving to the next
    // field, so the three int16 runs are strided rather than adjacent.
    for (let c = 0; c < channels; c += 1) {
      const choice = view.getUint8(blockStart + c);
      const [a, b] = table[choice] ?? table[0];
      coeff1[c] = a;
      coeff2[c] = b;
      delta[c] = view.getInt16(blockStart + channels + c * 2, true);
      sample1[c] = view.getInt16(blockStart + channels * 3 + c * 2, true);
      sample2[c] = view.getInt16(blockStart + channels * 5 + c * 2, true);

      // Older of the two header samples comes out first.
      out[c][written] = sample2[c] / 32768;
      if (samplesPerBlock > 1) out[c][written + 1] = sample1[c] / 32768;
    }

    let inBlock = Math.min(2, samplesPerBlock);
    let nibbleIndex = 0;
    const nibbleStart = blockStart + headerBytes;

    while (inBlock < samplesPerBlock) {
      const byteAt = nibbleStart + (nibbleIndex >> 1);
      if (byteAt >= blockEnd) break;

      for (let c = 0; c < channels; c += 1) {
        const at = nibbleStart + (nibbleIndex >> 1);
        if (at >= blockEnd) break;

        const byte = view.getUint8(at);
        const nibble = nibbleIndex & 1 ? byte & 0x0f : byte >> 4;
        nibbleIndex += 1;

        const predicted = (sample1[c] * coeff1[c] + sample2[c] * coeff2[c]) >> 8;
        // The nibble is a signed 4-bit residual.
        const signed = nibble & 8 ? nibble - 16 : nibble;
        const value = clampSample(predicted + signed * delta[c]);

        sample2[c] = sample1[c];
        sample1[c] = value;
        out[c][written + inBlock] = value / 32768;

        const next = (MS_ADAPT[nibble] * delta[c]) >> 8;
        delta[c] = next < 16 ? 16 : next;
      }

      inBlock += 1;
    }

    written += inBlock;
  }

  return trim(out, written);
}

/**
 * Room for every block the data could hold, including a short final one.
 *
 * Over-allocating and trimming afterwards is what lets a truncated recording
 * decode: the alternative is trusting a frame count the file may not have
 * survived long enough to write correctly.
 */
function allocate(size: number, spec: AdpcmSpec, headerBytes: number): Float32Array[] {
  const full = Math.floor(size / spec.blockAlign);
  const tail = size - full * spec.blockAlign;
  const blocks = full + (tail >= headerBytes ? 1 : 0);
  const capacity = Math.max(blocks * spec.samplesPerBlock, 0);

  return Array.from({ length: spec.channels }, () => new Float32Array(capacity));
}

function trim(channels: Float32Array[], length: number): { channels: Float32Array[]; length: number } {
  return {
    channels: channels.map((c) => (c.length === length ? c : c.subarray(0, length))),
    length,
  };
}
