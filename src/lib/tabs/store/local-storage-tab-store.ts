// =============================================================================
// LocalStorageTabStore — metadata in memory, XML in localStorage
//
// Persists diagram XML across page refreshes without a server.
// Suitable for moderate-sized diagrams; localStorage is capped at ~5 MB.
// Falls back to in-memory if the quota is exceeded.
//
// @example
//   const manager = new TabManager({}, new LocalStorageTabStore('my-app-tabs'));
// =============================================================================

import type { TabMeta, TabPatch } from '../types.js';
import { AbstractTabStore } from './abstract-tab-store.js';

export class LocalStorageTabStore extends AbstractTabStore {
  private readonly _map:    Map<string, TabMeta> = new Map();
  /** In-memory fallback cache for entries that failed to write to localStorage. */
  private readonly _cache:  Map<string, string>  = new Map();
  private readonly _prefix: string;

  /**
   * @param prefix  Key namespace in localStorage. Default: `'csp-bpmn-tab'`.
   */
  constructor(prefix = 'csp-bpmn-tab') {
    super();
    this._prefix = prefix;
  }

  private _key(id: string): string {
    return `${this._prefix}:xml:${id}`;
  }

  // ── Write ────────────────────────────────────────────────────────────────────

  add(meta: TabMeta): void {
    if (this._map.has(meta.id)) {
      throw new Error(`[LocalStorageTabStore] Tab "${meta.id}" already exists.`);
    }
    this._map.set(meta.id, meta);
    this._order.push(meta.id);
  }

  remove(id: string): TabMeta | undefined {
    const meta = this._map.get(id);
    if (!meta) return undefined;

    this._map.delete(id);
    this._cache.delete(id);
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
    try {
      localStorage.setItem(this._key(id), xml);
      this._cache.delete(id); // stored successfully, no need for fallback
    } catch (err) {
      // QuotaExceededError — keep in memory as fallback so the app keeps working
      console.warn('[LocalStorageTabStore] Storage full, using memory fallback:', err);
      this._cache.set(id, xml);
    }
  }

  async loadXml(id: string): Promise<string> {
    // Prefer localStorage; fall back to in-memory cache
    return localStorage.getItem(this._key(id)) ?? this._cache.get(id) ?? '';
  }

  async removeXml(id: string): Promise<void> {
    localStorage.removeItem(this._key(id));
    this._cache.delete(id);
  }

  override dispose(): void {
    // Remove all XML entries written by this store instance
    for (const id of this._order) {
      localStorage.removeItem(this._key(id));
    }
    this._cache.clear();
  }
}
