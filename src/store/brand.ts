/**
 * The practice profile.
 *
 * One practice per install, so this is a single record rather than a set of
 * switchable profiles. It supplies the fields a VA would otherwise retype into
 * every email: practice name, phone, booking link, their own name and title.
 */
import type { StorageAdapter } from './adapter.js';
import type { FieldValues } from '../merge/index.js';
import { BRAND_FIELDS } from '../library/types.js';

const KEY = 'brand-profile';

export type BrandProfile = Record<string, string>;

/** Keys the profile owns. Derived from the shared field definitions so the two
 *  cannot drift apart. */
export const BRAND_KEYS: string[] = BRAND_FIELDS.map((f) => f.key);

/**
 * Ships blank. The repository is public, so no real practice's details are
 * baked in: each install fills them in once under Practice details, and until
 * then templates show their own sample values.
 *
 * `practice_address` in particular must never get a placeholder. CAN-SPAM
 * requires a genuine postal address on bulk mail, and a placeholder that looks
 * real is worse than an empty required field the form will ask for.
 */
export const DEFAULT_BRAND: BrandProfile = {
  practice_name: '',
  practice_phone: '',
  practice_email: '',
  practice_website: '',
  practice_address: '',
  booking_url: '',
  unsubscribe_url: '',
  sender_name: '',
  sender_title: '',
};

/** Keep only known keys, and only non-empty strings. */
export function normalizeBrand(input: unknown): BrandProfile {
  const out: BrandProfile = {};
  if (!input || typeof input !== 'object') return out;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!BRAND_KEYS.includes(key)) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

/** Stored values win over defaults; blanks fall back. */
export function mergeBrand(stored: BrandProfile): BrandProfile {
  return { ...DEFAULT_BRAND, ...normalizeBrand(stored) };
}

export async function loadBrand(store: StorageAdapter): Promise<BrandProfile> {
  return mergeBrand((await store.get<BrandProfile>(KEY)) ?? {});
}

export async function saveBrand(store: StorageAdapter, profile: BrandProfile): Promise<void> {
  await store.set(KEY, normalizeBrand(profile));
}

export async function resetBrand(store: StorageAdapter): Promise<void> {
  await store.delete(KEY);
}

/**
 * The profile's values for the keys a template uses, and nothing else.
 *
 * Used to layer the practice profile *over* a template's generic samples: a
 * sample like "Example Health" is a placeholder, not the user's work, so the
 * real practice name must win. Precedence when seeding a template is
 * samples → profile → saved draft.
 */
export function brandValues(brand: BrandProfile, fieldKeys: string[]): FieldValues {
  const out: FieldValues = {};
  for (const key of fieldKeys) {
    const value = brand[key];
    if (value?.trim()) out[key] = value;
  }
  return out;
}

/**
 * Fill gaps in existing values from the profile.
 *
 * Anything already present wins — this fills blanks, it does not overwrite
 * work. Only keys the template actually uses are copied in.
 */
export function applyBrand(
  brand: BrandProfile,
  fieldKeys: string[],
  existing: FieldValues = {},
): FieldValues {
  const out: FieldValues = { ...existing };
  for (const key of fieldKeys) {
    if (out[key]?.trim()) continue;
    const value = brand[key];
    if (value) out[key] = value;
  }
  return out;
}

/** Profile fields still blank, so the UI can prompt for them once. */
export function incompleteBrandKeys(brand: BrandProfile): string[] {
  return BRAND_KEYS.filter((key) => !brand[key]?.trim());
}
