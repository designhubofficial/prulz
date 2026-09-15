import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter, type StorageAdapter } from '../src/store/adapter.js';
import {
  BRAND_KEYS, DEFAULT_BRAND, applyBrand, brandValues, incompleteBrandKeys, loadBrand,
  mergeBrand, normalizeBrand, resetBrand, saveBrand,
} from '../src/store/brand.js';
import {
  RECENT_LIMIT, clearAll, clearDraft, describeStoredData, listDraftIds,
  loadDraft, loadRecent, mergeRecent, recordRecent, saveDraft,
} from '../src/store/drafts.js';
import {
  DEFAULT_EMAIL_IDENTITY, loadEmailIdentity, normalizeEmailIdentity,
  resetEmailIdentity, saveEmailIdentity,
} from '../src/store/email-identity.js';

let store: StorageAdapter;
beforeEach(() => { store = new MemoryAdapter(); });

describe('MemoryAdapter', () => {
  it('round-trips values', async () => {
    await store.set('k', { a: 1 });
    expect(await store.get('k')).toEqual({ a: 1 });
  });

  it('returns undefined for a missing key', async () => {
    expect(await store.get('nope')).toBeUndefined();
  });

  it('isolates stored values from later mutation by the caller', async () => {
    const value = { a: 1 };
    await store.set('k', value);
    value.a = 999;
    expect(await store.get('k')).toEqual({ a: 1 });
  });

  it('lists and clears keys', async () => {
    await store.set('a', 1);
    await store.set('b', 2);
    expect((await store.keys()).sort()).toEqual(['a', 'b']);
    await store.delete('a');
    expect(await store.keys()).toEqual(['b']);
    await store.clear();
    expect(await store.keys()).toEqual([]);
  });
});

describe('brand profile', () => {
  it('ships without any real practice details', () => {
    // The repository is public, so the profile starts empty and each install
    // fills it in under Practice details.
    for (const key of ['practice_name', 'practice_phone', 'practice_email', 'practice_website', 'booking_url']) {
      expect(DEFAULT_BRAND[key], key).toBe('');
    }
  });

  it('leaves the postal address blank rather than inventing one', () => {
    // CAN-SPAM needs a real address; a plausible-looking placeholder is worse
    // than an empty required field the form will ask for.
    expect(DEFAULT_BRAND.practice_address).toBe('');
    expect(incompleteBrandKeys(DEFAULT_BRAND)).toContain('practice_address');
  });

  it('drops unknown keys and non-strings', () => {
    const clean = normalizeBrand({
      practice_name: 'Cedar', evil: 'x', practice_phone: 42, practice_email: '  ',
    });
    expect(clean).toEqual({ practice_name: 'Cedar' });
  });

  it('trims whitespace', () => {
    expect(normalizeBrand({ practice_name: '  Cedar  ' })).toEqual({ practice_name: 'Cedar' });
  });

  it('lets stored values win over defaults, but keeps defaults for blanks', () => {
    const merged = mergeBrand({ practice_name: 'Cedar Clinic', practice_phone: '' });
    expect(merged.practice_name).toBe('Cedar Clinic');
    expect(merged.practice_phone).toBe(DEFAULT_BRAND.practice_phone);
  });

  it('persists and reloads', async () => {
    await saveBrand(store, { ...DEFAULT_BRAND, practice_name: 'Cedar Clinic' });
    expect((await loadBrand(store)).practice_name).toBe('Cedar Clinic');
  });

  it('returns defaults before anything is saved', async () => {
    expect(await loadBrand(store)).toEqual(DEFAULT_BRAND);
  });

  it('resets back to defaults', async () => {
    await saveBrand(store, { practice_name: 'Cedar' });
    await resetBrand(store);
    expect((await loadBrand(store)).practice_name).toBe(DEFAULT_BRAND.practice_name);
  });

  it('covers every brand field key', () => {
    for (const key of BRAND_KEYS) expect(DEFAULT_BRAND).toHaveProperty(key);
  });

  describe('brandValues', () => {
    const brand = { practice_name: 'Cedar', practice_phone: '', sender_name: 'Jo' };

    it('returns only the keys the template asks for', () => {
      expect(brandValues(brand, ['practice_name'])).toEqual({ practice_name: 'Cedar' });
    });

    it('skips blanks so they do not mask a template sample', () => {
      expect(brandValues(brand, ['practice_phone'])).toEqual({});
    });

    it('overrides a generic sample when layered over one', () => {
      // Regression: the practice profile could not override a template's
      // sample, so the form showed "Example Health" instead of the real
      // practice name.
      const seeded = { ...{ practice_name: 'Example Health' }, ...brandValues(brand, ['practice_name']) };
      expect(seeded.practice_name).toBe('Cedar');
    });

    it('still loses to a saved draft', () => {
      const seeded = {
        ...{ practice_name: 'Example Health' },
        ...brandValues(brand, ['practice_name']),
        ...{ practice_name: 'What the user typed' },
      };
      expect(seeded.practice_name).toBe('What the user typed');
    });
  });

  describe('applyBrand', () => {
    const brand = { practice_name: 'Cedar', practice_phone: '503-555-0100' };

    it('fills only the keys the template asks for', () => {
      const out = applyBrand(brand, ['practice_name'], {});
      expect(out).toEqual({ practice_name: 'Cedar' });
    });

    it('never overwrites what the user already typed', () => {
      const out = applyBrand(brand, ['practice_name'], { practice_name: 'Mine' });
      expect(out.practice_name).toBe('Mine');
    });

    it('treats a whitespace-only value as empty and fills it', () => {
      expect(applyBrand(brand, ['practice_name'], { practice_name: '   ' }).practice_name)
        .toBe('Cedar');
    });

    it('skips keys the profile has no value for', () => {
      expect(applyBrand(brand, ['sender_name'], {})).toEqual({});
    });
  });
});

describe('email identity preferences', () => {
  it('defaults to a header placement with no custom logo', async () => {
    expect(await loadEmailIdentity(store)).toEqual(DEFAULT_EMAIL_IDENTITY);
  });

  it('ignores malformed stored values and migrates old signature toggles', () => {
    expect(normalizeEmailIdentity({ useLogo: 'yes', useSignature: true }))
      .toEqual(DEFAULT_EMAIL_IDENTITY);
    expect(normalizeEmailIdentity({ useLogo: false, useSignature: true }))
      .toEqual({ logoData: null, logoPlacement: 'hidden' });
    expect(normalizeEmailIdentity({
      logoData: 'data:image/png;base64,AAAA', logoPlacement: 'footer',
    })).toEqual({ logoData: 'data:image/png;base64,AAAA', logoPlacement: 'footer' });
  });

  it('persists, reloads, and resets', async () => {
    await saveEmailIdentity(store, {
      logoData: 'data:image/png;base64,AAAA', logoPlacement: 'footer',
    });
    expect(await loadEmailIdentity(store)).toEqual({
      logoData: 'data:image/png;base64,AAAA', logoPlacement: 'footer',
    });
    await resetEmailIdentity(store);
    expect(await loadEmailIdentity(store)).toEqual(DEFAULT_EMAIL_IDENTITY);
  });
});

describe('drafts', () => {
  it('saves and restores field values', async () => {
    await saveDraft(store, 'sch-reminder', { first_name: 'Alex' });
    expect((await loadDraft(store, 'sch-reminder'))?.values).toEqual({ first_name: 'Alex' });
  });

  it('records when it was saved', async () => {
    const before = Date.now();
    await saveDraft(store, 't', { a: '1' });
    expect((await loadDraft(store, 't'))!.savedAt).toBeGreaterThanOrEqual(before);
  });

  it('drops empty values rather than storing noise', async () => {
    await saveDraft(store, 't', { a: 'keep', b: '', c: '   ' });
    expect((await loadDraft(store, 't'))?.values).toEqual({ a: 'keep' });
  });

  it('removes the draft entirely when everything is cleared', async () => {
    await saveDraft(store, 't', { a: '1' });
    await saveDraft(store, 't', { a: '' });
    expect(await loadDraft(store, 't')).toBeUndefined();
  });

  it('keeps drafts separate per template', async () => {
    await saveDraft(store, 'a', { x: '1' });
    await saveDraft(store, 'b', { x: '2' });
    expect((await loadDraft(store, 'a'))?.values.x).toBe('1');
    expect((await listDraftIds(store)).sort()).toEqual(['a', 'b']);
  });

  it('clears one draft without touching the others', async () => {
    await saveDraft(store, 'a', { x: '1' });
    await saveDraft(store, 'b', { x: '2' });
    await clearDraft(store, 'a');
    expect(await listDraftIds(store)).toEqual(['b']);
  });
});

describe('recent values', () => {
  it('keeps the most recent first', () => {
    let recent = mergeRecent({}, { provider_name: 'Rosa' });
    recent = mergeRecent(recent, { provider_name: 'Sam' });
    expect(recent.provider_name).toEqual(['Sam', 'Rosa']);
  });

  it('moves a repeat to the front instead of duplicating it', () => {
    let recent = mergeRecent({}, { provider_name: 'Rosa' });
    recent = mergeRecent(recent, { provider_name: 'Sam' });
    recent = mergeRecent(recent, { provider_name: 'Rosa' });
    expect(recent.provider_name).toEqual(['Rosa', 'Sam']);
  });

  it('caps the list', () => {
    let recent = {};
    for (let i = 0; i < RECENT_LIMIT + 4; i++) {
      recent = mergeRecent(recent, { provider_name: `P${i}` });
    }
    expect(recent).toHaveProperty('provider_name');
    expect((recent as Record<string, string[]>).provider_name).toHaveLength(RECENT_LIMIT);
  });

  it('ignores blanks', () => {
    expect(mergeRecent({}, { provider_name: '   ' })).toEqual({});
  });

  it('does not remember one-off values', () => {
    // A patient's first name or a specific appointment date is never worth
    // offering again, and remembering names is exactly what we do not want.
    const recent = mergeRecent({}, {
      first_name: 'Alex', appt_date: '2026-03-04', provider_name: 'Rosa',
    });
    expect(recent).toEqual({ provider_name: ['Rosa'] });
  });

  it('persists across loads', async () => {
    await recordRecent(store, { provider_name: 'Rosa' });
    await recordRecent(store, { provider_name: 'Sam' });
    expect((await loadRecent(store)).provider_name).toEqual(['Sam', 'Rosa']);
  });

  it('starts empty', async () => {
    expect(await loadRecent(store)).toEqual({});
  });
});

describe('clearing stored data', () => {
  it('names what would be removed before removing it', async () => {
    await saveBrand(store, { practice_name: 'Cedar' });
    await saveDraft(store, 'a', { x: '1' });
    await saveDraft(store, 'b', { x: '2' });
    await recordRecent(store, { provider_name: 'Rosa' });

    expect(await describeStoredData(store))
      .toEqual({ drafts: 2, transcripts: 0, hadBrand: true, hadRecent: true });
  });

  it('removes everything and reports what went', async () => {
    await saveBrand(store, { practice_name: 'Cedar' });
    await saveDraft(store, 'a', { x: '1' });
    // A transcript is the most sensitive thing stored, so the summary has to
    // name it rather than letting it go silently with everything else.
    await store.set('transcript:t1', { id: 't1' });

    const summary = await clearAll(store);
    expect(summary).toEqual({ drafts: 1, transcripts: 1, hadBrand: true, hadRecent: false });
    expect(await store.keys()).toEqual([]);
    expect((await loadBrand(store)).practice_name).toBe(DEFAULT_BRAND.practice_name);
  });
});
