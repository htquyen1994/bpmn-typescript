// =============================================================================
// TabManager — Mediator pattern
//
// Orchestrates all tab operations.  Owns the TabStore and the TypedEventBus.
// Consumers (e.g. CSPBpm facade, TabBarUI) talk to this class exclusively
// — they never touch TabStore or the bus directly.
//
// Responsibilities:
//   • Create / remove / activate tabs (with optional before-activate hook)
//   • Manage isDirty / lifecycle transitions
//   • Snapshot state on tab switch
//   • Emit typed events so all subscribers stay in sync
// =============================================================================

import type {
  DiagramTabState,
  AddTabConfig,
  TabManagerConfig,
  TabEventMap,
  BeforeActivateHook,
  ViewboxSnapshot,
  TabLifecycle,
} from './types.js';
import { TypedEventBus } from './typed-event-bus.js';
import { TabStore }      from './tab-store.js';

// ── ID generation ─────────────────────────────────────────────────────────────

let _seq = 0;
const nextId    = (): string  => `tab-${Date.now()}-${++_seq}`;

// ── TabManager ────────────────────────────────────────────────────────────────

export class TabManager {
  /**
   * The event bus — subscribe here to react to any tab lifecycle event.
   *
   * @example
   * manager.events.on('tab.activated', ({ next }) => renderTabBar(next.id));
   * manager.events.on('tab.dirtied',   ({ tab })  => markUnsaved(tab.id));
   */
  readonly events = new TypedEventBus<TabEventMap>();

  private readonly _store:  TabStore;
  private readonly _config: Required<TabManagerConfig>;
  private _beforeActivate:  BeforeActivateHook | null = null;
  /** Monotonically increasing counter for default title numbering. */
  private _tabSeq = 0;

  constructor(config: TabManagerConfig = {}) {
    this._store  = new TabStore();
    this._config = {
      maxTabs:      config.maxTabs      ?? Infinity,
      defaultTitle: config.defaultTitle ?? 'Diagram',
    };
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  /**
   * Create and register a new tab.
   *
   * @returns The newly created `DiagramTabState`.
   * @throws  If `maxTabs` limit is already reached.
   *
   * @example
   * const tab = manager.add({ title: 'Order Process', xml: orderXml });
   */
  add(config: AddTabConfig = {}): DiagramTabState {
    if (this._store.count() >= this._config.maxTabs) {
      throw new Error(
        `[TabManager] Cannot add tab — limit of ${this._config.maxTabs} reached.`,
      );
    }

    this._tabSeq++;
    const tab: DiagramTabState = {
      id:        nextId(),
      index:     this._tabSeq,
      title:     config.title   ?? `${this._config.defaultTitle} ${this._tabSeq}`,
      isDirty:   false,
      lifecycle: 'idle',
      xml:       config.xml     ?? '',
      viewbox:   config.viewbox ?? null,
      createdAt: Date.now(),
      metadata:  { ...config.metadata },
    };

    this._store.add(tab);
    this.events.emit('tab.added', { tab });
    return tab;
  }

  // ── Activation ──────────────────────────────────────────────────────────────

  /**
   * Activate a tab by id.
   *
   * If a `beforeActivate` hook is registered it will be awaited; returning
   * `false` cancels the switch.
   *
   * @returns `true` when the switch completed, `false` when cancelled / noop.
   *
   * @example
   * const ok = await manager.activate(tab.id);
   * if (ok) loadDiagram(manager.getActive()!);
   */
  async activate(id: string): Promise<boolean> {
    const next = this._store.get(id);
    if (!next) return false;

    const current = this._store.getActive();
    if (current?.id === id) return false; // already active — no-op

    // ── BeforeActivate hook (Strategy) ────────────────────────────────────────
    if (this._beforeActivate) {
      const allowed = await this._beforeActivate(current ?? null, next);
      if (!allowed) return false;
    }

    this._store.setActive(id);
    this.events.emit('tab.activated', { prev: current ?? null, next });
    return true;
  }

  // ── Removal ─────────────────────────────────────────────────────────────────

  /**
   * Remove a tab from the store.
   *
   * The `tab.removed` event carries `adjacent` — the sibling that should
   * logically be activated next (the facade handles the actual switch).
   *
   * @returns The removed tab, or `undefined` if not found.
   */
  remove(id: string): DiagramTabState | undefined {
    const adjacent = this._store.getAdjacentTo(id);
    const removed  = this._store.remove(id);
    if (!removed) return undefined;

    this.events.emit('tab.removed', { tab: removed, adjacent: adjacent ?? null });
    return removed;
  }

  // ── State mutations ─────────────────────────────────────────────────────────

  /**
   * Apply arbitrary changes to a tab's mutable fields.
   * Emits `tab.updated` after patching.
   */
  patch(
    id:      string,
    changes: Partial<Omit<DiagramTabState, 'id' | 'index' | 'createdAt'>>,
  ): DiagramTabState | undefined {
    const tab = this._store.patch(id, changes);
    if (tab) this.events.emit('tab.updated', { tab });
    return tab;
  }

  /**
   * Persist the latest XML + viewport for a tab (called before switching away).
   * Does NOT emit an event — this is a silent bookkeeping operation.
   */
  snapshot(id: string, xml: string, viewbox: ViewboxSnapshot | null): void {
    this._store.snapshot(id, xml, viewbox);
  }

  /**
   * Transition a tab's lifecycle state.
   * Emits `tab.lifecycle` with the previous state for diff-checking.
   */
  setLifecycle(id: string, lifecycle: TabLifecycle): void {
    const tab = this._store.get(id);
    if (!tab) return;
    const prev = tab.lifecycle;
    this._store.setLifecycle(id, lifecycle);
    this.events.emit('tab.lifecycle', { tab: this._store.get(id)!, prev });
  }

  /**
   * Mark a tab as dirty (unsaved changes present).
   * Emits `tab.dirtied` only on the first transition false → true.
   */
  markDirty(id: string): void {
    const tab = this._store.get(id);
    if (!tab || tab.isDirty) return;
    this._store.patch(id, { isDirty: true });
    this.events.emit('tab.dirtied', { tab: this._store.get(id)! });
  }

  /**
   * Mark a tab as clean (all changes captured in a snapshot).
   * Emits `tab.cleaned` only on the first transition true → false.
   */
  markClean(id: string): void {
    const tab = this._store.get(id);
    if (!tab || !tab.isDirty) return;
    this._store.patch(id, { isDirty: false });
    this.events.emit('tab.cleaned', { tab: this._store.get(id)! });
  }

  // ── Reorder ─────────────────────────────────────────────────────────────────

  /**
   * Move a tab to a new position in the display order.
   * The tab bar UI is responsible for re-rendering; no event is emitted
   * (the view can call `getAll()` and reconcile itself).
   */
  move(id: string, toIndex: number): boolean {
    return this._store.move(id, toIndex);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  get(id: string): DiagramTabState | undefined {
    return this._store.get(id);
  }

  getActive(): DiagramTabState | undefined {
    return this._store.getActive();
  }

  getActiveId(): string | null {
    return this._store.getActiveId();
  }

  /** Returns all tabs in their current display order. */
  getAll(): DiagramTabState[] {
    return this._store.getAll();
  }

  getAdjacentTo(id: string): DiagramTabState | undefined {
    return this._store.getAdjacentTo(id);
  }

  has(id: string): boolean {
    return this._store.has(id);
  }

  count(): number {
    return this._store.count();
  }

  isEmpty(): boolean {
    return this._store.count() === 0;
  }

  // ── Hooks ────────────────────────────────────────────────────────────────────

  /**
   * Register a hook that is called before every tab activation.
   * Returning `false` (or `Promise<false>`) cancels the switch.
   * Pass `null` to remove the hook.
   *
   * @example
   * manager.setBeforeActivate(async (current, next) => {
   *   if (!current?.isDirty) return true;
   *   return confirm(`Leave "${current.title}" with unsaved changes?`);
   * });
   */
  setBeforeActivate(hook: BeforeActivateHook | null): void {
    this._beforeActivate = hook;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  /**
   * Remove all tabs and reset the event bus.
   * Useful for testing or full reset scenarios.
   */
  dispose(): void {
    for (const tab of this._store.getAll()) {
      this._store.remove(tab.id);
    }
    this.events.clear();
    this._beforeActivate = null;
  }
}
