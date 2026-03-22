// =============================================================================
// MemoryTabStore — in-memory implementation (default)
//
// All metadata and XML content live in JavaScript Maps.
// Zero I/O overhead — best performance, no persistence across page reloads.
// =============================================================================

import type { TabMeta, TabPatch } from '../types.js';
import { AbstractTabStore } from './abstract-tab-store.js';

export class MemoryTabStore extends AbstractTabStore {
  private readonly _map  = new Map<string, TabMeta>();
  private readonly _xmls = new Map<string, string>();

  // ── Write ────────────────────────────────────────────────────────────────────

  add(meta: TabMeta): void {
    if (this._map.has(meta.id)) {
      throw new Error(`[MemoryTabStore] Tab "${meta.id}" already exists.`);
    }
    this._map.set(meta.id, meta);
    this._order.push(meta.id);
  }

  remove(id: string): TabMeta | undefined {
    const meta = this._map.get(id);
    if (!meta) return undefined;

    this._map.delete(id);
    this._xmls.delete(id);
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
    this._xmls.set(id, xml);
  }

  async loadXml(id: string): Promise<string> {
    return this._xmls.get(id) ?? '';
  }

  async removeXml(id: string): Promise<void> {
    this._xmls.delete(id);
  }
}
