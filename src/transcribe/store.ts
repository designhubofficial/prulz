/**
 * Saved transcripts.
 *
 * Same store as drafts and the practice profile: IndexedDB in this browser,
 * nothing synced, nothing sent. Transcripts are kept under one prefix so the
 * "clear saved data" summary can count them by name rather than reporting a
 * number of anonymous keys.
 *
 * ## What is deliberately not stored
 *
 * **The audio.** A transcript is a few kilobytes of text; an hour of recording
 * is tens of megabytes, and keeping it would fill the origin's storage quota
 * within a handful of calls — at which point IndexedDB starts refusing writes
 * and the drafts stop saving too. Playback works from the file the user opened,
 * for as long as the tab is open, and the UI says so rather than implying a
 * recording is being kept.
 *
 * That is also the safer default. A browser profile quietly accumulating
 * recordings of patient calls is a liability on a shared or lost laptop, and
 * nobody would have chosen it deliberately.
 */
import type { StorageAdapter } from '../store/adapter.js';
import type { Transcript } from './types.js';

const PREFIX = 'transcript:';

/** Newest first — a transcript list is read from the top. */
export function byNewest(a: Transcript, b: Transcript): number {
  return b.createdAt - a.createdAt;
}

export async function saveTranscript(
  store: StorageAdapter,
  transcript: Transcript,
): Promise<void> {
  await store.set(PREFIX + transcript.id, transcript);
}

export async function loadTranscript(
  store: StorageAdapter,
  id: string,
): Promise<Transcript | undefined> {
  return normalizeTranscript(await store.get<Transcript>(PREFIX + id)) ?? undefined;
}

export async function deleteTranscript(store: StorageAdapter, id: string): Promise<void> {
  await store.delete(PREFIX + id);
}

export async function listTranscripts(store: StorageAdapter): Promise<Transcript[]> {
  const keys = (await store.keys()).filter((key) => key.startsWith(PREFIX));
  const loaded = await Promise.all(keys.map((key) => store.get<Transcript>(key)));

  // A key can outlive its value if a write was interrupted, and a transcript
  // written by an older build can be missing fields. Both are dropped or
  // repaired here so nothing above this line has to check.
  return loaded
    .map(normalizeTranscript)
    .filter((t): t is Transcript => t != null)
    .sort(byNewest);
}

export async function countTranscripts(store: StorageAdapter): Promise<number> {
  return (await store.keys()).filter((key) => key.startsWith(PREFIX)).length;
}

/**
 * Normalise a transcript read back from storage.
 *
 * A transcript saved by an older build can be missing fields this one reads —
 * the same reconciliation `normalizeSignature()` does, and for the same reason:
 * rendering nothing because a field arrived undefined is a worse outcome than
 * filling in a default.
 */
export function normalizeTranscript(raw: Partial<Transcript> | undefined): Transcript | null {
  if (!raw?.id || !Array.isArray(raw.segments)) return null;

  const segments = raw.segments.map((segment, index) => ({
    id: typeof segment.id === 'number' ? segment.id : index,
    start: Number(segment.start) || 0,
    end: Number(segment.end) || 0,
    text: String(segment.text ?? ''),
    speaker: Number(segment.speaker) || 0,
  }));

  const highest = segments.reduce((max, s) => Math.max(max, s.speaker), 0);
  const speakers = Array.from(
    { length: Math.max(highest + 1, raw.speakers?.length ?? 1) },
    (_, i) => raw.speakers?.[i] ?? `Speaker ${i + 1}`,
  );

  return {
    id: raw.id,
    name: raw.name ?? 'Untitled recording',
    createdAt: raw.createdAt ?? Date.now(),
    durationSec: Number(raw.durationSec) || 0,
    language: raw.language ?? 'auto',
    modelId: raw.modelId ?? 'unknown',
    segments,
    speakers,
  };
}
