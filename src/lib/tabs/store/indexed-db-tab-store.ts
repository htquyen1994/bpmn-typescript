// =============================================================================
// IndexedDBTabStore — metadata in memory, XML in IndexedDB
//
// Best choice for large diagrams: no size limit, truly asynchronous,
// persistent across page reloads, and survives localStorage quota limits.
//
// @example
//   const store   = new IndexedDBTabStore('my-app-diagrams');
//   const manager = new TabManager({}, store);
//   await store.ready; // optionally await DB open before first use
// =============================================================================

import type { TabMeta, TabPatch } from '../types.js';
import { AbstractTabStore } from './abstract-tab-store.js';

const DB_VERSION   = 1;
const STORE_NAME   = 'tab-xml';

export class IndexedDBTabStore extends AbstractTabStore {
  private readonly _map:    Map<string, TabMeta> = new Map();
  private readonly _dbName: string;
  private _db:              IDBDatabase | null = null;

  /**
   * Resolves when the IndexedDB connection is open and ready.
   * Await this before the first tab switch if you need guaranteed persistence.
   */
  readonly ready: Promise<void>;

  /**
   * @param dbName  IndexedDB database name. Default: `'csp-bpmn-tabs'`.
   */
  constructor(dbName = 'csp-bpmn-tabs') {
    super();
    this._dbName = dbName;
    this.ready   = this._open();
  }

  // ── Private – DB helpers ─────────────────────────────────────────────────────

  private _open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._dbName, DB_VERSION);

      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };

      req.onsuccess = () => {
        this._db = req.result;
        resolve();
      };

      req.onerror = () => reject(req.error);
    });
  }

  private async _store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    if (!this._db) await this.ready;
    // If still null after waiting, IndexedDB is unavailable
    if (!this._db) throw new Error('[IndexedDBTabStore] IndexedDB is not available.');
    return this._db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  private _request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Write ────────────────────────────────────────────────────────────────────

  add(meta: TabMeta): void {
    if (this._map.has(meta.id)) {
      throw new Error(`[IndexedDBTabStore] Tab "${meta.id}" already exists.`);
    }
    this._map.set(meta.id, meta);
    this._order.push(meta.id);
  }

  remove(id: string): TabMeta | undefined {
    const meta = this._map.get(id);
    if (!meta) return undefined;

    this._map.delete(id);
    const idx = this._order.indexOf(id);
    if (idx !== -1) this._order.splice(idx, 1);
    if (this._activeId === id) this._activeId = null;

    return meta;
  }

  patch(id: string, changes: TabPatch): TabMeta | undefined {
    const meta = this._map.get(id);
    if (!meta) return undefined;
    Object.assign(meta, changes);
    return meta;
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  get(id: string): TabMeta | undefined {
    return this._map.get(id);
  }

  getAll(): TabMeta[] {
    return this._order.map(id => this._map.get(id)!);
  }

  has(id: string): boolean {
    return this._map.has(id);
  }

  count(): number {
    return this._map.size;
  }

  // ── XML Content ───────────────────────────────────────────────────────────────

  async saveXml(id: string, xml: string): Promise<void> {
    const store = await this._store('readwrite');
    await this._request(store.put(xml, id));
  }

  async loadXml(id: string): Promise<string> {
    const store  = await this._store('readonly');
    const result = await this._request<string | undefined>(store.get(id));
    return result ?? '';
  }

  async removeXml(id: string): Promise<void> {
    const store = await this._store('readwrite');
    await this._request(store.delete(id));
  }

  override dispose(): void {
    this._db?.close();
    this._db = null;
  }
}
