
// =============================================================================
// TabStore — Repository pattern
//
// Single source of truth for DiagramTabState objects.
// Concerns: CRUD, ordering, active-tab pointer.
// Does NOT emit events — that is TabManager's responsibility.
// =============================================================================

import type { DiagramTabState, ViewboxSnapshot, TabLifecycle } from './types.js';

/** Fields that consumers may patch after creation (id and createdAt are immutable). */
export type TabPatch = Partial<Omit<DiagramTabState, 'id' | 'index' | 'createdAt'>>;

export class TabStore {
  /** Primary map: id → state object (mutated in place via `patch`). */
  private readonly _map   = new Map<string, DiagramTabState>();
  /**
   * Ordered list of tab IDs.
   * Maintained separately so ordering can be changed without touching the map.
   */
  private readonly _order: string[] = [];
  /** ID of the currently active tab, or null. */
  private _activeId: string | null = null;

  // ── Write ───────────────────────────────────────────────────────────────────

  /**
   * Insert a new tab.
   * @throws If a tab with the same `id` already exists.
   */
  add(tab: DiagramTabState): void {
    if (this._map.has(tab.id)) {
      throw new Error(`[TabStore] Tab id "${tab.id}" already exists.`);
    }
    this._map.set(tab.id, tab);
    this._order.push(tab.id);
  }

  /**
   * Remove a tab by id.
   * @returns The removed tab, or `undefined` if not found.
   */
  remove(id: string): DiagramTabState | undefined {
    const tab = this._map.get(id);
    if (!tab) return undefined;

    this._map.delete(id);
    const idx = this._order.indexOf(id);
    if (idx !== -1) this._order.splice(idx, 1);
    if (this._activeId === id) this._activeId = null;

    return tab;
  }

  /**
   * Apply a partial update to an existing tab (mutates in place).
   * @returns The updated tab, or `undefined` if not found.
   */
  patch(id: string, changes: TabPatch): DiagramTabState | undefined {
    const tab = this._map.get(id);
    if (!tab) return undefined;
    Object.assign(tab, changes);
    return tab;
  }

  /**
   * Convenience: update only `xml` + `viewbox` fields (snapshot on tab switch).
   */
  snapshot(
    id:      string,
    xml:     string,
    viewbox: ViewboxSnapshot | null,
  ): DiagramTabState | undefined {
    return this.patch(id, { xml, viewbox });
  }

  /**
   * Convenience: update only the `lifecycle` field.
   */
  setLifecycle(id: string, lifecycle: TabLifecycle): DiagramTabState | undefined {
    return this.patch(id, { lifecycle });
  }

  // ── Active pointer ──────────────────────────────────────────────────────────

  /**
   * Point the active-tab pointer at `id`.
   * @returns `false` if the id does not exist in the store.
   */
  setActive(id: string): boolean {
    if (!this._map.has(id)) return false;
    this._activeId = id;
    return true;
  }

  clearActive(): void {
    this._activeId = null;
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  get(id: string): DiagramTabState | undefined {
    return this._map.get(id);
  }

  getActive(): DiagramTabState | undefined {
    return this._activeId ? this._map.get(this._activeId) : undefined;
  }

  getActiveId(): string | null {
    return this._activeId;
  }

  /** Returns all tabs in their current display order. */
  getAll(): DiagramTabState[] {
    return this._order.map(id => this._map.get(id)!);
  }

  has(id: string): boolean {
    return this._map.has(id);
  }

  count(): number {
    return this._map.size;
  }

  indexOf(id: string): number {
    return this._order.indexOf(id);
  }

  /**
   * Returns the nearest sibling of `id` — prefers the next tab, falls back to
   * the previous one.  Returns `undefined` if there are no other tabs.
   */
  getAdjacentTo(id: string): DiagramTabState | undefined {
    const idx = this._order.indexOf(id);
    if (idx === -1) return undefined;
    const siblingId = this._order[idx + 1] ?? this._order[idx - 1];
    return siblingId ? this._map.get(siblingId) : undefined;
  }

  // ── Ordering ────────────────────────────────────────────────────────────────

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
}
