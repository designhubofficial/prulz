/**
 * Export formats.
 *
 * Five, matching what the native tools this borrows from produce: plain text
 * and Markdown for reading, SRT and VTT for anything that plays alongside the
 * audio, and JSON for a system that wants the structure back.
 *
 * The subtitle writers are the fussy ones. SRT and VTT differ in three details
 * — the decimal separator, the required header, and the cue numbering — and a
 * player that rejects a file gives no useful reason, so both are written
 * against the spec rather than by adapting one into the other.
 */
import type { Segment, Transcript } from './types.js';
import { toTurns } from './segments.js';

/* ----------------------------------------------------------- timestamps */

/** `H:MM:SS` for reading; the hour is dropped under an hour. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

/**
 * `HH:MM:SS,mmm` (SRT) or `HH:MM:SS.mmm` (VTT).
 *
 * Milliseconds are floored, not rounded. Rounding up can push a cue's end past
 * the next cue's start, and overlapping cues are the one thing players handle
 * inconsistently — some drop the second cue entirely.
 */
export function cueTime(seconds: number, separator: ',' | '.'): string {
  const clamped = Math.max(0, seconds);
  const whole = Math.floor(clamped);
  const ms = Math.floor((clamped - whole) * 1000);

  const h = String(Math.floor(whole / 3600)).padStart(2, '0');
  const m = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
  const s = String(whole % 60).padStart(2, '0');

  return `${h}:${m}:${s}${separator}${String(ms).padStart(3, '0')}`;
}

/** `4 min 12 sec`, for the header. Under a minute reads in seconds alone. */
export function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} sec`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

/* -------------------------------------------------------------- writers */

export type ExportFormat = 'txt' | 'md' | 'srt' | 'vtt' | 'json';

export interface FormatSpec {
  id: ExportFormat;
  label: string;
  extension: string;
  mime: string;
  /** What it is for, so the choice does not need explaining twice. */
  note: string;
}

export const FORMATS: FormatSpec[] = [
  { id: 'txt', label: 'Plain text', extension: 'txt', mime: 'text/plain', note: 'Speaker turns, no timecodes.' },
  { id: 'md', label: 'Markdown', extension: 'md', mime: 'text/markdown', note: 'Headed, with timecodes.' },
  { id: 'srt', label: 'Subtitles (SRT)', extension: 'srt', mime: 'application/x-subrip', note: 'For a video or audio player.' },
  { id: 'vtt', label: 'Subtitles (VTT)', extension: 'vtt', mime: 'text/vtt', note: 'The web-native subtitle format.' },
  { id: 'json', label: 'JSON', extension: 'json', mime: 'application/json', note: 'Full structure, for another system.' },
];

export function formatById(id: string): FormatSpec {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

/** Speaker name for an index, tolerating a transcript whose names ran short. */
function speakerName(transcript: Transcript, index: number): string {
  return transcript.speakers[index] ?? `Speaker ${index + 1}`;
}

/**
 * Plain text, grouped into speaker turns.
 *
 * Turns rather than segments because a transcript read as forty two-second rows
 * is unreadable, and reading it is the entire point of this format.
 */
export function toText(transcript: Transcript): string {
  return toTurns(transcript.segments)
    .map((turn) => {
      const body = turn.segments.map((s) => s.text.trim()).join(' ').replace(/\s+/g, ' ');
      return `${speakerName(transcript, turn.speaker)}: ${body}`;
    })
    .join('\n\n');
}

/** Markdown, with a header block and a timecode against each turn. */
export function toMarkdown(transcript: Transcript): string {
  const created = new Date(transcript.createdAt).toISOString().slice(0, 10);

  const header = [
    `# ${transcript.name}`,
    '',
    `- **Transcribed** ${created}`,
    `- **Length** ${duration(transcript.durationSec)}`,
    `- **Model** ${transcript.modelId}`,
    `- **Language** ${transcript.language}`,
    '',
    '> Speaker labels are a guess from pauses in the audio, not voice recognition. Check them before relying on who said what.',
    '',
    '---',
    '',
  ].join('\n');

  const body = toTurns(transcript.segments)
    .map((turn) => {
      const text = turn.segments.map((s) => s.text.trim()).join(' ').replace(/\s+/g, ' ');
      return `**${speakerName(transcript, turn.speaker)}** _(${clock(turn.start)})_\n\n${text}`;
    })
    .join('\n\n');

  return `${header}${body}\n`;
}

/**
 * SubRip.
 *
 * Cues are numbered from 1 and separated by a blank line, with a trailing
 * newline at the end of the file — players are forgiving about the last one and
 * strict about the others.
 */
export function toSrt(segments: Segment[]): string {
  return segments
    .map((segment, index) =>
      [
        String(index + 1),
        `${cueTime(segment.start, ',')} --> ${cueTime(endOf(segment), ',')}`,
        segment.text.trim(),
        '',
      ].join('\n'),
    )
    .join('\n');
}

/** WebVTT. Same cues, a period for the decimal, and the required header. */
export function toVtt(segments: Segment[]): string {
  const cues = segments
    .map((segment) =>
      [
        `${cueTime(segment.start, '.')} --> ${cueTime(endOf(segment), '.')}`,
        segment.text.trim(),
        '',
      ].join('\n'),
    )
    .join('\n');

  return `WEBVTT\n\n${cues}`;
}

/**
 * A cue needs a positive length or players skip it.
 *
 * Whisper emits zero-length segments on very short utterances — "Mm-hm", a
 * name repeated back. They are real speech and belong in the file, so they get
 * a minimum duration rather than being dropped.
 */
const MIN_CUE_SEC = 0.2;

function endOf(segment: Segment): number {
  return Math.max(segment.end, segment.start + MIN_CUE_SEC);
}

/** The whole structure, versioned so a future reader knows what it is holding. */
export function toJson(transcript: Transcript): string {
  return JSON.stringify({ version: 1, ...transcript }, null, 2);
}

export function toFormat(transcript: Transcript, format: ExportFormat): string {
  switch (format) {
    case 'txt': return toText(transcript);
    case 'md': return toMarkdown(transcript);
    case 'srt': return toSrt(transcript.segments);
    case 'vtt': return toVtt(transcript.segments);
    case 'json': return toJson(transcript);
  }
}

/**
 * A filename that survives every OS.
 *
 * Windows rejects `\ / : * ? " < > |` outright and silently mangles trailing
 * dots. A transcript named after an audio file called `Call 3/14 — Mrs. R.m4a`
 * would otherwise produce a download that fails with no message.
 *
 * A name made entirely of those characters cleans down to a run of dashes,
 * which is technically legal and useless in a downloads folder — so the
 * fallback triggers on "no letter or digit survived", not on "empty".
 */
export function safeFilename(name: string, extension: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 80);

  return `${/[\p{L}\p{N}]/u.test(base) ? base : 'transcript'}.${extension}`;
}
