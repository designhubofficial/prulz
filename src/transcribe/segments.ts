/**
 * Turning raw Whisper output into a transcript, and editing it afterwards.
 *
 * Everything here is pure. The model runs in a worker and the store runs in
 * IndexedDB; this file is the part with the rules in it, so the rules can be
 * tested in Node without either.
 *
 * ## On speaker labels
 *
 * This does **not** do acoustic diarization. Telling voices apart requires a
 * second model — an embedding network plus clustering — which is another few
 * hundred megabytes and a large amount of code for a result that is still wrong
 * often enough to need correcting.
 *
 * Instead it splits on silence: a gap longer than `TURN_GAP_SEC` is treated as
 * the other person starting to talk, and speakers alternate. On a two-party
 * phone call — which is what a VA is transcribing — that is right most of the
 * time and obviously wrong when it is wrong, which is the useful failure mode.
 * Every label is one click to reassign.
 *
 * The labels are presented as a guess throughout the UI. Calling a heuristic
 * "speaker identification" and letting someone file it in a chart would be the
 * genuinely harmful version of this feature.
 */
import type { RawChunk, Segment, Transcript } from './types.js';

/**
 * Silence long enough to read as a handover.
 *
 * Chosen from how phone calls actually sound: a speaker pausing mid-sentence
 * leaves under half a second, while the handover between two people on a line
 * with any latency at all leaves closer to a second. Below ~0.6s this splits
 * single sentences in half; above ~1.2s it merges a question and its answer
 * into one turn, which is worse because it is harder to spot.
 */
export const TURN_GAP_SEC = 0.9;

/** Cap on speakers the gap heuristic will invent before it stops alternating. */
export const MAX_GUESSED_SPEAKERS = 2;

/**
 * Slack on the gap comparison.
 *
 * Whisper timestamps land on multiples of 0.02s, so a gap of exactly the
 * threshold is a case that really occurs — and subtracting two of those floats
 * gives 0.8999999999999999, which fails a bare `>=`. One millisecond of slack
 * makes the boundary behave the way the threshold is documented to.
 */
const GAP_EPSILON = 0.001;

/* ------------------------------------------------------------ assembling */

/**
 * Build segments from the pipeline's chunks.
 *
 * Three things have to be handled, all of which show up on real audio:
 *
 *   - **A null end timestamp.** Whisper leaves `end` null on the final chunk.
 *     It becomes the clip duration, or the start if the duration is unknown.
 *   - **Empty and whitespace-only chunks.** Dropped. They come from music,
 *     hold tones and line noise, and each one would otherwise be a blank row.
 *   - **Non-monotonic timestamps.** Long-form decoding occasionally emits a
 *     chunk starting before the previous one ended. The start is clamped
 *     forward so the transcript stays sortable and playback never jumps back.
 */
export function toSegments(chunks: RawChunk[], durationSec: number): Segment[] {
  const out: Segment[] = [];
  let previousEnd = 0;

  for (const chunk of chunks) {
    const text = chunk.text.trim();
    if (!text) continue;

    const rawStart = Number.isFinite(chunk.timestamp[0]) ? chunk.timestamp[0] : previousEnd;
    const start = Math.max(rawStart, previousEnd);

    const rawEnd = chunk.timestamp[1];
    const end = rawEnd == null || !Number.isFinite(rawEnd)
      ? Math.max(start, durationSec || start)
      : Math.max(rawEnd, start);

    out.push({ id: out.length, start, end, text, speaker: 0 });
    previousEnd = end;
  }

  return assignSpeakers(out);
}

/**
 * Alternate speakers across silences.
 *
 * Returns a new array; the input is not touched. Runs on assembly and again
 * after a re-split, so it has to be idempotent for a given gap threshold.
 */
export function assignSpeakers(
  segments: Segment[],
  gapSec = TURN_GAP_SEC,
  maxSpeakers = MAX_GUESSED_SPEAKERS,
): Segment[] {
  let speaker = 0;

  return segments.map((segment, index) => {
    if (index > 0) {
      const gap = segment.start - segments[index - 1].end;
      if (gap >= gapSec - GAP_EPSILON) speaker = (speaker + 1) % maxSpeakers;
    }
    return { ...segment, speaker };
  });
}

/** Default names for however many speakers the heuristic used. */
export function defaultSpeakerNames(segments: Segment[]): string[] {
  const highest = segments.reduce((max, s) => Math.max(max, s.speaker), 0);
  return Array.from({ length: highest + 1 }, (_, i) => `Speaker ${i + 1}`);
}

/* -------------------------------------------------------------- editing */

/** Replace one segment's text. Blank text is allowed — deleting is a separate act. */
export function editText(transcript: Transcript, id: number, text: string): Transcript {
  return {
    ...transcript,
    segments: transcript.segments.map((s) => (s.id === id ? { ...s, text } : s)),
  };
}

/** Move one segment to another speaker. */
export function setSpeaker(transcript: Transcript, id: number, speaker: number): Transcript {
  return {
    ...transcript,
    segments: transcript.segments.map((s) => (s.id === id ? { ...s, speaker } : s)),
    speakers: ensureSpeaker(transcript.speakers, speaker),
  };
}

/**
 * Move a segment and everything after it to another speaker.
 *
 * The common correction by a wide margin: the heuristic gets one handover wrong
 * early and every label after it is inverted. Fixing that a row at a time on an
 * hour-long call is not a feature anyone would use twice.
 */
export function setSpeakerFrom(transcript: Transcript, id: number, speaker: number): Transcript {
  const index = transcript.segments.findIndex((s) => s.id === id);
  if (index < 0) return transcript;

  const from = transcript.segments[index].speaker;
  if (from === speaker) return transcript;

  return {
    ...transcript,
    segments: transcript.segments.map((s, i) =>
      i >= index && s.speaker === from ? { ...s, speaker } : s,
    ),
    speakers: ensureSpeaker(transcript.speakers, speaker),
  };
}

/** Rename a speaker. Empty names fall back to the positional default. */
export function renameSpeaker(transcript: Transcript, index: number, name: string): Transcript {
  const speakers = ensureSpeaker(transcript.speakers, index);
  return {
    ...transcript,
    speakers: speakers.map((s, i) => (i === index ? name.trim() || `Speaker ${i + 1}` : s)),
  };
}

function ensureSpeaker(speakers: string[], index: number): string[] {
  if (index < speakers.length) return speakers;
  const out = [...speakers];
  while (out.length <= index) out.push(`Speaker ${out.length + 1}`);
  return out;
}

/** Drop a segment — a hold tone or a stretch of crosstalk that came out as noise. */
export function removeSegment(transcript: Transcript, id: number): Transcript {
  return { ...transcript, segments: transcript.segments.filter((s) => s.id !== id) };
}

/**
 * Merge a segment into the one before it.
 *
 * Whisper splits on its own rhythm, which does not always match a sentence.
 * Merging keeps the earlier start and the later end so the timings stay true.
 */
export function mergeWithPrevious(transcript: Transcript, id: number): Transcript {
  const index = transcript.segments.findIndex((s) => s.id === id);
  if (index <= 0) return transcript;

  const previous = transcript.segments[index - 1];
  const current = transcript.segments[index];
  const merged: Segment = {
    ...previous,
    end: Math.max(previous.end, current.end),
    text: `${previous.text} ${current.text}`.replace(/\s+/g, ' ').trim(),
  };

  const segments = [...transcript.segments];
  segments.splice(index - 1, 2, merged);
  return { ...transcript, segments };
}

/* --------------------------------------------------------------- reading */

/** Consecutive segments by one speaker, which is how a transcript is read. */
export interface Turn {
  speaker: number;
  start: number;
  end: number;
  segments: Segment[];
}

export function toTurns(segments: Segment[]): Turn[] {
  const out: Turn[] = [];

  for (const segment of segments) {
    const last = out[out.length - 1];
    if (last && last.speaker === segment.speaker) {
      last.segments.push(segment);
      last.end = Math.max(last.end, segment.end);
    } else {
      out.push({
        speaker: segment.speaker,
        start: segment.start,
        end: segment.end,
        segments: [segment],
      });
    }
  }

  return out;
}

/**
 * Full-text search over segments.
 *
 * Plain case-insensitive substring matching, deliberately — no regex anywhere
 * in the path. A VA searching for a dosage like `2.5 mg` or a code like
 * `99213 (` is typing regex metacharacters without meaning to; compiling the
 * query would make `.` match any character and an unbalanced bracket throw.
 * `includes` gives them what they typed, and needs no escaping to do it.
 */
export function searchSegments(segments: Segment[], query: string): Segment[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return segments.filter((s) => s.text.toLowerCase().includes(needle));
}

/** Word count across the transcript, for the header line. */
export function wordCount(segments: Segment[]): number {
  return segments.reduce(
    (total, s) => total + (s.text.trim() ? s.text.trim().split(/\s+/).length : 0),
    0,
  );
}
