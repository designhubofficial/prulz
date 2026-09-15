import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter, type StorageAdapter } from '../src/store/adapter.js';
import { clearAll } from '../src/store/drafts.js';
import {
  PDF_SIGNATURES_KEY, SIGNATURE_LIMIT, SIGNATURE_NAME_LIMIT, addSignature, isPngBytes,
  isPngDataUrl, loadSignatures, normalizeSignatures, removeSignature, signatureName,
  type NewSignature,
} from '../src/store/pdf-signatures.js';

const png = (payload = 'iVBORw0KGgo='): string => `data:image/png;base64,${payload}`;
const signature = (overrides: Partial<NewSignature> = {}): NewSignature => ({
  name: 'My signature', dataUrl: png(), width: 600, height: 200, source: 'upload', ...overrides,
});

let store: StorageAdapter;
beforeEach(() => { store = new MemoryAdapter(); });

describe('saved PDF signatures', () => {
  it('starts empty', async () => {
    expect(await loadSignatures(store)).toEqual([]);
  });

  it('saves newest first and survives a reload', async () => {
    await addSignature(store, signature({ name: 'First', dataUrl: png('AAAA') }));
    const list = await addSignature(store, signature({ name: 'Second', dataUrl: png('BBBB'), source: 'drawn' }));
    expect(list.map((entry) => entry.name)).toEqual(['Second', 'First']);
    expect(await loadSignatures(store)).toEqual(list);
    expect(list[0]).toMatchObject({ source: 'drawn', width: 600, height: 200 });
    expect(list[0]!.id).not.toBe(list[1]!.id);
  });

  it('refuses anything that is not a PNG', async () => {
    await expect(addSignature(store, signature({ dataUrl: 'data:image/jpeg;base64,/9j/4AAQ' }))).rejects.toThrow('PNG');
    await expect(addSignature(store, signature({ dataUrl: 'javascript:alert(1)' }))).rejects.toThrow();
    expect(await store.get(PDF_SIGNATURES_KEY)).toBeUndefined();
  });

  it('refuses an image with no size', async () => {
    await expect(addSignature(store, signature({ width: 0 }))).rejects.toThrow();
  });

  it('moves a re-uploaded image to the front instead of duplicating it', async () => {
    const first = await addSignature(store, signature({ name: 'Old name', dataUrl: png('AAAA') }));
    await addSignature(store, signature({ dataUrl: png('BBBB') }));
    const list = await addSignature(store, signature({ name: 'New name', dataUrl: png('AAAA') }));
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: first[0]!.id, name: 'New name' });
  });

  it(`keeps at most ${SIGNATURE_LIMIT}, dropping the oldest`, async () => {
    for (let i = 0; i < SIGNATURE_LIMIT + 2; i++) {
      await addSignature(store, signature({ name: `Signature ${i}`, dataUrl: png(`A${'A'.repeat(i)}`) }));
    }
    const list = await loadSignatures(store);
    expect(list).toHaveLength(SIGNATURE_LIMIT);
    expect(list[0]!.name).toBe(`Signature ${SIGNATURE_LIMIT + 1}`);
    expect(list.some((entry) => entry.name === 'Signature 0')).toBe(false);
  });

  it('removes one signature, and the key once the list is empty', async () => {
    await addSignature(store, signature({ name: 'Keep', dataUrl: png('AAAA') }));
    const list = await addSignature(store, signature({ name: 'Remove', dataUrl: png('BBBB') }));
    expect((await removeSignature(store, list[0]!.id)).map((entry) => entry.name)).toEqual(['Keep']);
    await removeSignature(store, list[1]!.id);
    expect(await store.get(PDF_SIGNATURES_KEY)).toBeUndefined();
  });

  it('is deleted by "clear all saved data"', async () => {
    await addSignature(store, signature());
    await clearAll(store);
    expect(await loadSignatures(store)).toEqual([]);
  });
});

describe('normalizeSignatures', () => {
  it('drops malformed entries and duplicate ids', () => {
    const valid = { id: 'a', name: '  Dr. Smith  ', dataUrl: png(), width: 10, height: 5, source: 'drawn', createdAt: 1 };
    const result = normalizeSignatures([
      valid,
      { ...valid },
      { ...valid, id: 'b', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
      { ...valid, id: 'c', width: -1 },
      { ...valid, id: 'd', source: 'unknown', createdAt: 'yesterday' },
      null,
      'nonsense',
    ]);
    expect(result.map((entry) => entry.id)).toEqual(['a', 'd']);
    expect(result[0]!.name).toBe('Dr. Smith');
    expect(result[1]).toMatchObject({ source: 'upload', createdAt: 0 });
  });

  it('treats a non-array as nothing saved', () => {
    expect(normalizeSignatures({ id: 'a' })).toEqual([]);
    expect(normalizeSignatures(undefined)).toEqual([]);
  });
});

describe('signature helpers', () => {
  it('names an upload after its file, without the extension', () => {
    expect(signatureName('klein-signature.PNG')).toBe('klein-signature');
    expect(signatureName('   ')).toBe('My signature');
    expect(signatureName('x'.repeat(80))).toHaveLength(SIGNATURE_NAME_LIMIT);
  });

  it('recognises PNG data URLs only', () => {
    expect(isPngDataUrl(png())).toBe(true);
    expect(isPngDataUrl('data:image/png;base64,not base64!')).toBe(false);
    expect(isPngDataUrl('data:image/jpeg;base64,AAAA')).toBe(false);
    expect(isPngDataUrl(42)).toBe(false);
  });

  it('checks the PNG file signature rather than the extension', () => {
    expect(isPngBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe(true);
    expect(isPngBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]))).toBe(false);
    expect(isPngBytes(new Uint8Array([0x89, 0x50]))).toBe(false);
  });
});
