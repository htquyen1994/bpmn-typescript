// =============================================================================
// AbstractTabStore — Strategy pattern for tab data persistence
//
// Separates storage concerns:
//   • Metadata ops (sync)  — always kept hot in memory for instant UI rendering.
//   • XML content ops (async) — may reside in localStorage, IndexedDB, or a
//     remote API; the concrete implementation decides where.
//
// How to implement a custom backend:
//   1. Extend AbstractTabStore.
//   2. Implement all abstract methods.
//   3. Pass the instance to `TabManager` constructor second argument.
//
// @example
//   const manager = new TabManager({ defaultTitle: 'Flow' }, new IndexedDBTabStore());
// =============================================================================

import type { TabMeta, TabPatch } from '../types.js';

export abstract class AbstractTabStore {
  // Maintained in the abstract base so all implementations share identical
  // ordering and active-pointer logic (lightweight, always in-memory).
  protected readonly _order: string[] = [];
  protected _activeId: string | null = null;

  // ── Write (sync) ─────────────────────────────────────────────────────────────

  /**
   * Insert a new tab.
   * @throws If a tab with the same `id` already exists.
   */
  abstract add(meta: TabMeta): void;

  /**
   * Remove a tab by id.
   * @returns The removed metadata, or `undefined` if not found.
   */
  abstract remove(id: string): TabMeta | undefined;

  /**
   * Apply a partial update to a tab's mutable fields (mutates in place).
   * @returns The updated metadata, or `undefined` if not found.
   */
  abstract patch(id: string, changes: TabPatch): TabMeta | undefined;

  // ── Active pointer (sync) ────────────────────────────────────────────────────

  /**
   * Point the active-tab pointer at `id`.
   * @returns `false` if the id does not exist in the store.
   */
  setActive(id: string): boolean {
    if (!this.has(id)) return false;
    this._activeId = id;
    return true;
  }

  clearActive(): void {
    this._activeId = null;
  }

  getActiveId(): string | null {
    return this._activeId;
  }

  getActive(): TabMeta | undefined {
    return this._activeId ? this.get(this._activeId) : undefined;
  }

  // ── Read (sync) ──────────────────────────────────────────────────────────────

  abstract get(id: string): TabMeta | undefined;

  /** Returns all tabs in their current display order. */
  abstract getAll(): TabMeta[];

  abstract has(id: string): boolean;
  abstract count(): number;

  indexOf(id: string): number {
    return this._order.indexOf(id);
  }

  /**
   * Returns the nearest sibling of `id` — prefers the next tab, falls back to
   * the previous one. Returns `undefined` if there are no other tabs.
   */
  getAdjacentTo(id: string): TabMeta | undefined {
    const idx = this._order.indexOf(id);
    if (idx === -1) return undefined;
    const siblingId = this._order[idx + 1] ?? this._order[idx - 1];
    return siblingId ? this.get(siblingId) : undefined;
  }

  // ── Ordering (sync) ──────────────────────────────────────────────────────────

  /**
   * Move a tab to a new position in the display order (drag-to-reorder).
   * @returns `false` if the id is not found.
   */
  move(id: string, toIndex: number): boolean {
    const from = this._order.indexOf(id);
    if (from === -1) return false;
    this._order.splice(from, 1);
    const clamped = Math.max(0, Math.min(toIndex, this._order.length));
    this._order.splice(clamped, 0, id);
    return true;
  }

  // ── XML Content (async) ──────────────────────────────────────────────────────

  /**
   * Persist the XML content for a tab.
   * Called on every snapshot (tab switch or explicit save).
   */
  abstract saveXml(id: string, xml: string): Promise<void>;

  /**
   * Load the XML content for a tab.
   * Called when a tab is about to be activated.
   * Should return an empty string if no XML has been saved yet.
   */
  abstract loadXml(id: string): Promise<string>;

  /**
   * Remove XML content when a tab is deleted.
   * Implementations should clean up any persisted data for the given id.
   */
  abstract removeXml(id: string): Promise<void>;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  /**
   * Called by `TabManager.dispose()`.
   * Override to clean up resources (DB connections, localStorage keys, etc.).
   */
  dispose(): void {}
}
