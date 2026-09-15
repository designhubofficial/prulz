/**
 * Drafts and recent values.
 *
 * Two small features that make the tool feel like it remembers you:
 *
 *   - a draft per template, so closing the tab mid-email loses nothing
 *   - recent values per field, so a provider name typed last week is one click
 *     away rather than retyped
 *
 * Both are per-browser. There is no server, so nothing syncs between machines —
 * the UI says so rather than letting anyone assume otherwise.
 */
import type { StorageAdapter } from './adapter.js';
import type { FieldValues } from '../merge/index.js';

const DRAFT_PREFIX = 'draft:';
const RECENT_KEY = 'recent-values';

/** How many past entries to keep per field. Enough to be useful, short enough
 *  to stay a glanceable list. */
export const RECENT_LIMIT = 6;

/** Fields whose values are too situational to be worth offering again. */
const NEVER_REMEMBER = new Set([
  'first_name', 'recipient_name', 'balance_amount',
  'appt_date', 'appt_time', 'due_date', 'closure_date', 'original_date',
  'slot_date', 'slot_time', 'first_visit_date', 'submitted_date',
  'transition_date', 'effective_date', 'change_date', 'referral_date',
  'start_date', 'event_date', 'event_time', 'week_of',
]);

/* --------------------------------------------------------------- drafts */

export interface Draft {
  templateId: string;
  values: FieldValues;
  savedAt: number;
}

export async function saveDraft(
  store: StorageAdapter,
  templateId: string,
  values: FieldValues,
): Promise<void> {
  const kept = pruneEmpty(values);
  if (!Object.keys(kept).length) {
    await store.delete(DRAFT_PREFIX + templateId);
    return;
  }
  const draft: Draft = { templateId, values: kept, savedAt: Date.now() };
  await store.set(DRAFT_PREFIX + templateId, draft);
}

export async function loadDraft(
  store: StorageAdapter,
  templateId: string,
): Promise<Draft | undefined> {
  return store.get<Draft>(DRAFT_PREFIX + templateId);
}

export async function clearDraft(store: StorageAdapter, templateId: string): Promise<void> {
  await store.delete(DRAFT_PREFIX + templateId);
}

export async function listDraftIds(store: StorageAdapter): Promise<string[]> {
  const keys = await store.keys();
  return keys.filter((k) => k.startsWith(DRAFT_PREFIX)).map((k) => k.slice(DRAFT_PREFIX.length));
}

function pruneEmpty(values: FieldValues): FieldValues {
  const out: FieldValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' && value.trim()) out[key] = value;
  }
  return out;
}

/* -------------------------------------------------------- recent values */

export type RecentValues = Record<string, string[]>;

/**
 * Fold new values into the recent list: most recent first, no duplicates,
 * capped per field. Pure, so the ordering rules are testable directly.
 */
export function mergeRecent(existing: RecentValues, values: FieldValues): RecentValues {
  const out: RecentValues = { ...existing };

  for (const [key, raw] of Object.entries(values)) {
    if (NEVER_REMEMBER.has(key)) continue;
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;

    const previous = out[key] ?? [];
    out[key] = [value, ...previous.filter((v) => v !== value)].slice(0, RECENT_LIMIT);
  }

  return out;
}

export async function recordRecent(store: StorageAdapter, values: FieldValues): Promise<void> {
  const existing = (await store.get<RecentValues>(RECENT_KEY)) ?? {};
  await store.set(RECENT_KEY, mergeRecent(existing, values));
}

export async function loadRecent(store: StorageAdapter): Promise<RecentValues> {
  return (await store.get<RecentValues>(RECENT_KEY)) ?? {};
}

/* ---------------------------------------------------------------- reset */

export interface ClearSummary {
  drafts: number;
  /** Saved call transcripts. Counted here so "clear everything" can name them —
   *  a transcript is the most sensitive thing this app stores, and deleting one
   *  without saying so is the wrong kind of surprise. */
  transcripts: number;
  hadBrand: boolean;
  hadRecent: boolean;
}

/**
 * What a "clear everything" would remove, so the confirmation can name it
 * rather than asking the user to trust a generic warning.
 */
export async function describeStoredData(store: StorageAdapter): Promise<ClearSummary> {
  const keys = await store.keys();
  return {
    drafts: keys.filter((k) => k.startsWith(DRAFT_PREFIX)).length,
    transcripts: keys.filter((k) => k.startsWith('transcript:')).length,
    hadBrand: keys.includes('brand-profile'),
    hadRecent: keys.includes(RECENT_KEY),
  };
}

export async function clearAll(store: StorageAdapter): Promise<ClearSummary> {
  const summary = await describeStoredData(store);
  await store.clear();
  return summary;
}
