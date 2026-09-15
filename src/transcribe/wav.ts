/**
 * A WAV decoder of our own, for the files the browser's decoder refuses.
 *
 * `decodeAudioData` is strict in ways a dictation workflow runs into constantly.
 * It rejects a WAV whose header sizes are wrong — which is every recording that
 * was cut short, streamed to disk, or written by a recorder that never went back
 * to patch the RIFF size field. It rejects the telephony codecs (mu-law, A-law)
 * that call-recording systems still emit inside a .wav container, and on some
 * builds it rejects 24-bit and WAVE_FORMAT_EXTENSIBLE. The file plays fine
 * everywhere else, so "convert it to WAV" reads as nonsense to someone whose
 * file is already a WAV.
 *
 * So: parse it here. Being ours, it can be lenient about the header and strict
 * only about the samples — and it reaches the two ADPCM codecs that hide inside
 * a .wav and that no browser decodes (see `adpcm.ts`). Pure functions over an
 * ArrayBuffer, so the whole thing is testable in Node.
 */

import {
  IMA_ADPCM, MS_ADPCM, decodeIma, decodeMs, imaSamplesPerBlock, msSamplesPerBlock,
} from './adpcm.js';

/** Sample formats a `fmt ` chunk can name. Anything else we cannot read. */
const FORMAT_PCM = 0x0001;
const FORMAT_FLOAT = 0x0003;
const FORMAT_ALAW = 0x0006;
const FORMAT_MULAW = 0x0007;
const FORMAT_EXTENSIBLE = 0xfffe;

export class WavParseError extends Error {}

export interface ParsedWav {
  channels: Float32Array[];
  sampleRate: number;
  /** Frames per channel. */
  length: number;
}

/** Does this look like a RIFF/WAVE file at all? Cheap enough to ask first. */
export function isWav(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) return false;
  const view = new DataView(bytes);
  const riff = ascii(view, 0);
  // RF64 and BW64 are the >4 GB variants; field-recorder software writes them
  // routinely at sizes nowhere near 4 GB, and the body is identical.
  if (riff !== 'RIFF' && riff !== 'RF64' && riff !== 'BW64') return false;
  return ascii(view, 8) === 'WAVE';
}

function ascii(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1),
    view.getUint8(offset + 2), view.getUint8(offset + 3),
  );
}

interface Chunk {
  id: string;
  start: number;
  size: number;
}

/**
 * Walk the chunk list, believing the file's byte length over the file's own
 * size fields.
 *
 * A declared size is a hint here, not a boundary: a truncated recording leaves
 * `data` claiming more than exists, and RF64 deliberately writes 0xFFFFFFFF and
 * expects the reader to look elsewhere. Both are ordinary, and both decode
 * perfectly if the declared length is simply clamped to what is actually there.
 */
function chunks(view: DataView): Chunk[] {
  const found: Chunk[] = [];
  let offset = 12;

  while (offset + 8 <= view.byteLength) {
    const id = ascii(view, offset);
    const declared = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const available = view.byteLength - start;
    const size = Math.min(declared, available);

    found.push({ id, start, size });

    // Chunks are word-aligned; the pad byte is not counted in the size.
    const advance = size + (size % 2);
    if (advance <= 0) break;
    offset = start + advance;
  }

  return found;
}

interface Format {
  code: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  /** Bytes per block. Only the block codecs use it. */
  blockAlign: number;
  /** Frames per block, as declared. Zero when the file does not say. */
  samplesPerBlock: number;
  /** MS ADPCM predictor pairs, when the file overrides the standard ones. */
  coefficients?: Array<[number, number]>;
}

function readFormat(view: DataView, chunk: Chunk): Format {
  if (chunk.size < 16) throw new WavParseError('Its format header is too short to read.');

  let code = view.getUint16(chunk.start, true);
  const channels = view.getUint16(chunk.start + 2, true);
  const sampleRate = view.getUint32(chunk.start + 4, true);
  const blockAlign = view.getUint16(chunk.start + 12, true);
  const bitsPerSample = view.getUint16(chunk.start + 14, true);

  // WAVE_FORMAT_EXTENSIBLE puts the real format code in the first two bytes of
  // a 16-byte GUID in the extension. Most 24-bit and multichannel files are
  // written this way.
  if (code === FORMAT_EXTENSIBLE && chunk.size >= 40) {
    code = view.getUint16(chunk.start + 24, true);
  }

  if (channels < 1) throw new WavParseError('It reports no audio channels.');
  if (sampleRate < 1) throw new WavParseError('It reports no sample rate.');

  return {
    code, channels, sampleRate, bitsPerSample, blockAlign,
    ...readBlockExtension(view, chunk, code),
  };
}

/**
 * The extra `fmt ` fields the block codecs add after the standard 16 bytes.
 *
 * Both declare their frames-per-block there, and MS ADPCM may carry its own
 * predictor table. Everything here is optional: the block size implies the
 * frame count, so a header that stops short is not a problem.
 */
function readBlockExtension(
  view: DataView,
  chunk: Chunk,
  code: number,
): { samplesPerBlock: number; coefficients?: Array<[number, number]> } {
  if (code !== IMA_ADPCM && code !== MS_ADPCM) return { samplesPerBlock: 0 };
  if (chunk.size < 20) return { samplesPerBlock: 0 };

  const samplesPerBlock = view.getUint16(chunk.start + 18, true);
  if (code !== MS_ADPCM || chunk.size < 22) return { samplesPerBlock };

  const count = view.getUint16(chunk.start + 20, true);
  // Two int16 per pair, and only as many as actually fit in the chunk.
  const available = Math.floor((chunk.size - 22) / 4);
  const usable = Math.min(count, available);
  if (usable < 1) return { samplesPerBlock };

  const coefficients = Array.from({ length: usable }, (_, i): [number, number] => [
    view.getInt16(chunk.start + 22 + i * 4, true),
    view.getInt16(chunk.start + 24 + i * 4, true),
  ]);

  return { samplesPerBlock, coefficients };
}

/** Per-sample readers. Each returns a value already scaled to -1..1. */
type SampleReader = (view: DataView, offset: number) => number;

function readerFor(format: Format): { read: SampleReader; bytes: number } {
  const { code, bitsPerSample } = format;

  if (code === FORMAT_MULAW) return { read: readMuLaw, bytes: 1 };
  if (code === FORMAT_ALAW) return { read: readALaw, bytes: 1 };

  if (code === FORMAT_FLOAT) {
    if (bitsPerSample === 32) {
      return { read: (v, o) => v.getFloat32(o, true), bytes: 4 };
    }
    if (bitsPerSample === 64) {
      return { read: (v, o) => v.getFloat64(o, true), bytes: 8 };
    }
    throw new WavParseError(`It uses ${bitsPerSample}-bit floating point samples.`);
  }

  if (code === FORMAT_PCM) {
    switch (bitsPerSample) {
      // 8-bit PCM is the one unsigned depth in the format: 0..255 around 128.
      case 8:
        return { read: (v, o) => (v.getUint8(o) - 128) / 128, bytes: 1 };
      case 16:
        return { read: (v, o) => v.getInt16(o, true) / 32768, bytes: 2 };
      case 24:
        return { read: read24, bytes: 3 };
      case 32:
        return { read: (v, o) => v.getInt32(o, true) / 2147483648, bytes: 4 };
      default:
        throw new WavParseError(`It uses ${bitsPerSample}-bit samples.`);
    }
  }

  throw new WavParseError(
    `It uses audio compression this tool cannot read (format ${code}).`,
  );
}

/**
 * Hand the block codecs a spec they can trust.
 *
 * The declared frames-per-block is preferred but not believed: a value that
 * disagrees with what the block size can physically hold would run the decoder
 * off the end of every block, so it loses to the arithmetic.
 */
function decodeBlocks(
  view: DataView,
  start: number,
  size: number,
  format: Format,
): { channels: Float32Array[]; length: number } {
  const { code, channels, blockAlign, samplesPerBlock, coefficients } = format;
  const ima = code === IMA_ADPCM;
  const headerBytes = (ima ? 4 : 7) * channels;

  if (blockAlign <= headerBytes) {
    throw new WavParseError('Its compressed block size is too small to hold audio.');
  }

  const implied = ima
    ? imaSamplesPerBlock(blockAlign, channels)
    : msSamplesPerBlock(blockAlign, channels);
  const frames = samplesPerBlock > 0 && samplesPerBlock <= implied ? samplesPerBlock : implied;

  const spec = { channels, blockAlign, samplesPerBlock: frames, coefficients };
  return ima ? decodeIma(view, start, size, spec) : decodeMs(view, start, size, spec);
}

/** 24-bit little-endian signed, sign-extended by hand — DataView has no getInt24. */
function read24(view: DataView, offset: number): number {
  const raw = view.getUint8(offset)
    | (view.getUint8(offset + 1) << 8)
    | (view.getUint8(offset + 2) << 16);
  const signed = raw & 0x800000 ? raw - 0x1000000 : raw;
  return signed / 8388608;
}

/**
 * G.711 mu-law, the codec of every recorded phone call in North America.
 *
 * Both companding tables below are the standard decode: invert the stored byte,
 * pull out sign, exponent and mantissa, and expand back to linear.
 */
function readMuLaw(view: DataView, offset: number): number {
  const byte = ~view.getUint8(offset) & 0xff;
  const sign = byte & 0x80;
  const exponent = (byte >> 4) & 0x07;
  const mantissa = byte & 0x0f;
  const value = (((mantissa << 3) + 0x84) << exponent) - 0x84;
  return (sign ? -value : value) / 32768;
}

/** G.711 A-law, the same idea with European bit packing. */
function readALaw(view: DataView, offset: number): number {
  const byte = view.getUint8(offset) ^ 0x55;
  const sign = byte & 0x80;
  const exponent = (byte >> 4) & 0x07;
  const mantissa = byte & 0x0f;
  const value = exponent === 0
    ? (mantissa << 4) + 8
    : ((mantissa << 4) + 0x108) << (exponent - 1);
  return (sign ? -value : value) / 32768;
}

/**
 * Bytes → per-channel float samples.
 *
 * Throws `WavParseError` with a sentence naming what about the file we could
 * not read, because this runs after the browser has already refused it and the
 * message is the only thing the user has left to act on.
 */
export function parseWav(bytes: ArrayBuffer): ParsedWav {
  if (!isWav(bytes)) throw new WavParseError('It is not a RIFF/WAVE file.');

  const view = new DataView(bytes);
  const list = chunks(view);

  const fmtChunk = list.find((c) => c.id === 'fmt ');
  if (!fmtChunk) throw new WavParseError('It has no format header.');

  const dataChunk = list.find((c) => c.id === 'data');
  if (!dataChunk) throw new WavParseError('It has no audio data.');

  // A `data` size of zero means "still being written" — a recorder that streams
  // to disk sets it last, and never gets to if the session ends badly. The walk
  // stops at a zero-length chunk, so nothing follows it to overrun into: the
  // audio is simply the rest of the file.
  const dataSize = dataChunk.size === 0
    ? view.byteLength - dataChunk.start
    : dataChunk.size;

  const format = readFormat(view, fmtChunk);

  // The block codecs address their data in blocks, not frames, so they take a
  // different path entirely rather than a per-sample reader.
  if (format.code === IMA_ADPCM || format.code === MS_ADPCM) {
    const { channels, length } = decodeBlocks(view, dataChunk.start, dataSize, format);
    if (length < 1) throw new WavParseError('It contains no audio — the file is empty.');
    return { channels, sampleRate: format.sampleRate, length };
  }

  const { read, bytes: sampleBytes } = readerFor(format);

  const frameBytes = sampleBytes * format.channels;
  const frames = Math.floor(dataSize / frameBytes);
  if (frames < 1) throw new WavParseError('It contains no audio — the file is empty.');

  const channels = Array.from(
    { length: format.channels },
    () => new Float32Array(frames),
  );

  // Samples are interleaved by frame: all channels of frame 0, then frame 1.
  for (let frame = 0; frame < frames; frame += 1) {
    const base = dataChunk.start + frame * frameBytes;
    for (let channel = 0; channel < format.channels; channel += 1) {
      channels[channel][frame] = read(view, base + channel * sampleBytes);
    }
  }

  return { channels, sampleRate: format.sampleRate, length: frames };
}
