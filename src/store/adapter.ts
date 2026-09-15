/**
 * Storage backend.
 *
 * A tiny key-value interface with two implementations: IndexedDB for normal
 * use, and an in-memory map for when IndexedDB is unavailable — private
 * browsing, a locked-down browser, or storage the user has blocked.
 *
 * The point of the seam is that the app never has to care. Everything above
 * this file is testable without a browser, and the app degrades to "works, but
 * forgets" instead of failing outright.
 */

export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

/** Fallback used when IndexedDB will not open. Data lives until the tab closes. */
export class MemoryAdapter implements StorageAdapter {
  private readonly map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    // Structured-clone the value so callers cannot mutate what is stored,
    // matching how IndexedDB actually behaves.
    this.map.set(key, typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value)));
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}

const DB_NAME = 'dispatch';
const DB_VERSION = 1;
const STORE = 'kv';

class IndexedDbAdapter implements StorageAdapter {
  constructor(private readonly db: IDBDatabase) {}

  private run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  get<T>(key: string): Promise<T | undefined> {
    return this.run<T | undefined>('readonly', (s) => s.get(key));
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.run('readwrite', (s) => s.put(value, key));
  }

  async delete(key: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(key));
  }

  async keys(): Promise<string[]> {
    const keys = await this.run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
    return keys.map(String);
  }

  async clear(): Promise<void> {
    await this.run('readwrite', (s) => s.clear());
  }
}

export interface OpenResult {
  adapter: StorageAdapter;
  /** False when data will not survive a reload, so the UI can say so. */
  persistent: boolean;
}

/**
 * Open the best available store.
 *
 * Never throws: a browser that refuses IndexedDB gets the memory adapter and a
 * `persistent: false` flag rather than a broken app.
 */
export async function openStorage(): Promise<OpenResult> {
  if (typeof indexedDB === 'undefined') {
    return { adapter: new MemoryAdapter(), persistent: false };
  }

  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB blocked'));
      // Firefox in private mode can hang rather than error.
      setTimeout(() => reject(new Error('IndexedDB open timed out')), 3000);
    });

    return { adapter: new IndexedDbAdapter(db), persistent: true };
  } catch {
    return { adapter: new MemoryAdapter(), persistent: false };
  }
}
