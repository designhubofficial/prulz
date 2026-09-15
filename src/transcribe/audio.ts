/**
 * Getting audio into the shape Whisper wants.
 *
 * The model takes **mono 32-bit float at 16 kHz** and nothing else. Everything
 * a VA actually has — a phone recorder's m4a, a Zoom mp4, a dictation wav — is
 * some other rate, usually stereo, often compressed. This file is the whole
 * conversion, and it happens locally — the browser's decoder for compressed
 * containers, our own `wav.ts` for WAV — so no codec ships with the app and no
 * file is uploaded anywhere to be converted.
 *
 * The pure parts (`downmix`, format checks, size formatting) are separated from
 * the Web Audio calls so the arithmetic can be tested in Node.
 */

import { isWav, parseWav, WavParseError } from './wav.js';

/** Whisper's fixed input rate. Not a preference — the model will not take another. */
export const TARGET_RATE = 16_000;

/**
 * What the file picker accepts.
 *
 * WAV we decode ourselves, so it behaves the same everywhere. The rest is the
 * browser's, and support varies a little by browser and OS — m4a on
 * Firefox/Linux is the usual gap. A file that will not decode says which of
 * those it hit rather than failing somewhere deeper.
 */
export const ACCEPTED = '.mp3,.m4a,.wav,.aac,.ogg,.opus,.flac,.webm,.mp4,.mov,audio/*,video/*';

export const ACCEPTED_LABEL = 'MP3, M4A, WAV, AAC, OGG, FLAC, WebM, MP4 or MOV';

/**
 * Refuse absurd inputs before decoding rather than during.
 *
 * Decoding expands audio to 4 bytes per sample per channel, so a 500 MB
 * compressed file becomes multiple gigabytes of Float32 and takes the tab with
 * it. The limit is on the compressed size because that is what can be checked
 * without paying the cost first.
 */
export const MAX_FILE_BYTES = 300 * 1024 * 1024;


export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return mb < 100 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

/**
 * Average the channels into one.
 *
 * Averaging rather than taking the left channel matters on the recordings this
 * tool is aimed at: a two-party call recorded to stereo often has each side on
 * its own channel, and keeping only the left would transcribe half the
 * conversation and give no sign that it had.
 */
export function downmix(channels: Float32Array[], length: number): Float32Array {
  if (channels.length === 1) return channels[0];

  const out = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i += 1) out[i] += channel[i];
  }

  const scale = 1 / channels.length;
  for (let i = 0; i < length; i += 1) out[i] *= scale;

  return out;
}

export interface DecodedAudio {
  samples: Float32Array;
  durationSec: number;
}

export class AudioDecodeError extends Error {}

/**
 * Put decoded samples into a deliberately boring format the browser can play.
 *
 * The picker accepts formats that the transcription decoder can read even when
 * the native media element cannot (IMA/MS ADPCM WAV is the common example).
 * A small PCM WAV is a useful local compatibility bridge for the player: it
 * keeps the audio on this device and does not require shipping another codec.
 */
export function encodePcmWav(samples: Float32Array, sampleRate = TARGET_RATE): ArrayBuffer {
  if (!Number.isFinite(sampleRate) || sampleRate < 1) {
    throw new RangeError('A positive sample rate is required.');
  }

  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, Math.round(sampleRate), true);
  view.setUint32(28, Math.round(sampleRate) * 2, true);
  view.setUint16(32, 2, true); // mono, 16-bit
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i += 1) {
    const sample = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i])) : 0;
    const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(44 + i * 2, Math.round(pcm), true);
  }

  return buffer;
}

/** What either decoder hands back before downmixing and resampling. */
interface RawAudio {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
}

/**
 * File → 16 kHz mono float samples.
 *
 * Two decoders, and which one goes first depends on the container. WAV is read
 * by `parseWav` because the browser's decoder rejects a pile of ordinary WAVs
 * it has no real need to — see `wav.ts`. Everything else is the browser's, since
 * decoding m4a or mp4 means shipping a codec otherwise. Each falls back to the
 * other, so a WAV holding something exotic (ADPCM, MP3-in-WAV) still gets the
 * browser's attempt, and a mislabelled file still gets ours.
 *
 * Resampling goes through `OfflineAudioContext` rather than passing a
 * `sampleRate` to a live `AudioContext`. Both work in Chrome; only the offline
 * path resamples reliably in Safari, and doing it in one place means one
 * behaviour to reason about instead of two.
 */
export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  if (file.size > MAX_FILE_BYTES) {
    throw new AudioDecodeError(
      `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)} — ` +
      'split the recording, or export it at a lower bitrate.',
    );
  }

  const bytes = await file.arrayBuffer();
  const raw = isWav(bytes)
    ? await decodeWav(bytes, file)
    : await decodeInBrowser(bytes, file);

  const mono = downmix(raw.channels, raw.length);
  const durationSec = raw.length / raw.sampleRate;

  if (raw.sampleRate === TARGET_RATE) return { samples: mono, durationSec };

  return { samples: await resample(mono, raw.sampleRate), durationSec };
}

/**
 * Our parser first, the browser second.
 *
 * `parseWav` fails only on a WAV whose payload is compressed, and that is
 * exactly the case the browser might still handle — so its complaint becomes
 * the explanation if the browser cannot manage it either. That combined message
 * is the point of the ordering: "already a .wav, convert it to WAV" was the
 * least useful thing we could have said.
 */
async function decodeWav(bytes: ArrayBuffer, file: File): Promise<RawAudio> {
  try {
    return parseWav(bytes);
  } catch (error) {
    const reason = error instanceof WavParseError ? error.message : undefined;
    return decodeInBrowser(bytes, file, reason);
  }
}

async function decodeInBrowser(
  bytes: ArrayBuffer,
  file: File,
  wavReason?: string,
): Promise<RawAudio> {
  const Ctor = window.AudioContext ?? (window as unknown as {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;
  if (!Ctor) throw new AudioDecodeError('This browser has no audio decoder.');

  const context = new Ctor();
  let buffer: AudioBuffer;
  try {
    // `decodeAudioData` detaches the buffer it is given, so nothing may read
    // `bytes` after this call — which is why the WAV parser runs before it.
    buffer = await context.decodeAudioData(bytes);
  } catch (error) {
    throw new AudioDecodeError(decodeFailureMessage(file, wavReason, error));
  } finally {
    // The context holds an audio device open; a tool that decodes several files
    // in a session would otherwise accumulate them until the browser cuts it off.
    void context.close();
  }

  return {
    channels: Array.from(
      { length: buffer.numberOfChannels },
      (_, i) => buffer.getChannelData(i),
    ),
    sampleRate: buffer.sampleRate,
    length: buffer.length,
  };
}

/**
 * Say what is actually wrong with the file.
 *
 * Advice worth acting on needs to distinguish a container this browser lacks a
 * codec for — where another browser or a re-export genuinely helps — from a
 * file we read well enough to know it is compressed or corrupt, where it does
 * not. The browser's own DOMException message is usually generic, so it goes
 * last and only when it adds something.
 */
function decodeFailureMessage(file: File, wavReason: string | undefined, error: unknown): string {
  if (wavReason) {
    return `Could not read ${file.name}. ${wavReason} ` +
      'Re-export it as 16-bit PCM WAV or MP3 and try again.';
  }

  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return `This browser has no decoder for ${file.name}${detail}. ` +
    'Re-export it as WAV or MP3 and try again.';
}

async function resample(samples: Float32Array, fromRate: number): Promise<Float32Array> {
  const frames = Math.ceil((samples.length * TARGET_RATE) / fromRate);

  const OfflineCtor = window.OfflineAudioContext ?? (window as unknown as {
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  }).webkitOfflineAudioContext;
  if (!OfflineCtor) throw new AudioDecodeError('This browser cannot resample audio.');

  const offline = new OfflineCtor(1, frames, TARGET_RATE);

  const source = offline.createBufferSource();
  const buffer = offline.createBuffer(1, samples.length, fromRate);
  // `copyToChannel` is typed against a Float32Array backed by a plain
  // ArrayBuffer; `getChannelData` returns the ArrayBufferLike form. Same bytes.
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}
