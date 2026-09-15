import type { Transcript } from './types.js';
import { readCall, notesToText } from './actions.js';
/** Extractive notes without clinical inference. */
export function summarize(transcript: Transcript): string {
  if (!transcript.segments.length) return 'No transcript to summarize.';
  return notesToText(transcript, readCall(transcript));
}
