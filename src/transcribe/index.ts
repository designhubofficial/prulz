/**
 * The transcriber.
 *
 * Audio in, an editable transcript out, entirely inside the browser. Whisper
 * runs as ONNX on WebGPU with a WASM fallback; the weights are fetched from
 * Hugging Face once and cached, and that fetch is the only network request the
 * tool makes. No audio, no transcript and no identifier leaves the machine —
 * the same guarantee the rest of the dashboard makes, extended to a file format
 * that would otherwise have forced a server.
 *
 * Layout mirrors the rest of `src/`: pure rules in their own files, the model
 * behind a worker, storage behind the shared adapter.
 */
export * from './types.js';
export {
  TIERS, DEFAULT_TIER, LANGUAGES, DTYPES, WASM_DTYPE,
  tierById, isTierId, normalizeTier, languageLabel,
} from './models.js';
export {
  TURN_GAP_SEC, toSegments, assignSpeakers, defaultSpeakerNames, toTurns,
  editText, setSpeaker, setSpeakerFrom, renameSpeaker, removeSegment,
  mergeWithPrevious, searchSegments, wordCount,
  type Turn,
} from './segments.js';
export {
  FORMATS, clock, cueTime, duration, formatById, safeFilename,
  toFormat, toText, toMarkdown, toSrt, toVtt, toJson,
  type ExportFormat, type FormatSpec,
} from './format.js';
export {
  findActions, findDetails, suggestTemplates, readCall, notesToText, toSentences,
  type ActionItem, type CallNotes, type Detail, type Suggestion,
} from './actions.js';
export {
  ACCEPTED, ACCEPTED_LABEL, MAX_FILE_BYTES, TARGET_RATE,
  AudioDecodeError, decodeAudioFile, downmix, encodePcmWav, formatBytes,
} from './audio.js';
export {
  WavParseError, isWav, parseWav,
  type ParsedWav,
} from './wav.js';
export {
  IMA_ADPCM, MS_ADPCM, decodeIma, decodeMs,
  imaSamplesPerBlock, msSamplesPerBlock,
  type AdpcmSpec,
} from './adpcm.js';
export {
  TranscribeRun, TranscribeCancelled, releaseTranscriber, webGpuAvailable,
} from './engine.js';
export {
  saveTranscript, loadTranscript, deleteTranscript, listTranscripts,
  countTranscripts, normalizeTranscript, byNewest,
} from './store.js';
