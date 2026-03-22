// =============================================================================
// TabManager — Mediator pattern
//
// Orchestrates all tab operations. Owns a pluggable AbstractTabStore and the
// TypedEventBus.  Consumers (e.g. CSPBpm facade, TabBarUI) talk to this class
// exclusively — they never touch the store or the bus directly.
//
// Responsibilities:
//   • Create / remove / activate tabs (with optional before-activate hook)
//   • Manage isDirty / lifecycle transitions
//   • Snapshot state on tab switch (async — delegates XML to the store backend)
//   • Emit typed events so all subscribers stay in sync
//
// Storage backend:
//   Pass a custom AbstractTabStore as the second constructor argument.
//   Defaults to MemoryTabStore (everything in JS memory, zero I/O).
//
// @example
//   // Default — in-memory
//   const manager = new TabManager({ defaultTitle: 'Diagram' });
//
//   // Persist XML across page reloads
//   const manager = new TabManager({}, new LocalStorageTabStore('my-app'));
//
//   // Large diagrams — IndexedDB backend
//   const manager = new TabManager({}, new IndexedDBTabStore('my-app'));
// =============================================================================

import type {
  TabMeta,
  DiagramTabState,
  AddTabConfig,
  TabManagerConfig,
  TabEventMap,
  BeforeActivateHook,
  ViewboxSnapshot,
  TabLifecycle,
  TabPatch,
} from './types.js';
import { TypedEventBus }     from './typed-event-bus.js';
import { MemoryTabStore }    from './store/memory-tab-store.js';
import type { AbstractTabStore } from './store/abstract-tab-store.js';

// ── ID generation ─────────────────────────────────────────────────────────────

let _seq = 0;
const nextId = (): string => `tab-${Date.now()}-${++_seq}`;

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

  private readonly _store:  AbstractTabStore;
  private readonly _config: Required<TabManagerConfig>;
  private _beforeActivate:  BeforeActivateHook | null = null;
  /** Monotonically increasing counter for default title numbering. */
  private _tabSeq = 0;

  /**
   * @param config  Tab manager configuration (maxTabs, defaultTitle).
   * @param store   Storage backend. Defaults to `MemoryTabStore`.
   */
  constructor(config: TabManagerConfig = {}, store?: AbstractTabStore) {
    this._store  = store ?? new MemoryTabStore();
    this._config = {
      maxTabs:      config.maxTabs      ?? Infinity,
      defaultTitle: config.defaultTitle ?? 'Diagram',
    };
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  /**
   * Create and register a new tab.
   *
   * If `config.xml` is provided it is saved to the store backend immediately
   * (fire-and-forget). The tab is returned synchronously with lightweight
   * metadata; use `loadTab(id)` to retrieve the full state including XML.
   *
   * @returns The newly created `TabMeta`.
   * @throws  If `maxTabs` limit is already reached.
   *
   * @example
   * const tab = manager.add({ title: 'Order Process', xml: orderXml });
   */
  add(config: AddTabConfig = {}): TabMeta {
    if (this._store.count() >= this._config.maxTabs) {
      throw new Error(
        `[TabManager] Cannot add tab — limit of ${this._config.maxTabs} reached.`,
      );
    }

    this._tabSeq++;
    const meta: TabMeta = {
      id:        nextId(),
      index:     this._tabSeq,
      title:     config.title   ?? `${this._config.defaultTitle} ${this._tabSeq}`,
      isDirty:   false,
      lifecycle: 'idle',
      viewbox:   config.viewbox ?? null,
      createdAt: Date.now(),
      metadata:  { ...config.metadata },
    };

    this._store.add(meta);

    // Persist initial XML if provided (fire-and-forget — no blocking)
    if (config.xml) {
      void this._store.saveXml(meta.id, config.xml);
    }

    this.events.emit('tab.added', { tab: meta });
    return meta;
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
   * if (ok) await loadDiagram(manager.getActive()!);
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
   * logically be activated next (the studio handles the actual switch).
   *
   * @returns The removed tab metadata, or `undefined` if not found.
   */
  remove(id: string): TabMeta | undefined {
    const adjacent = this._store.getAdjacentTo(id);
    const removed  = this._store.remove(id);
    if (!removed) return undefined;

    // Remove persisted XML from the backend (fire-and-forget)
    void this._store.removeXml(id);

    this.events.emit('tab.removed', { tab: removed, adjacent: adjacent ?? null });
    return removed;
  }

  // ── State mutations ─────────────────────────────────────────────────────────

  /**
   * Apply arbitrary changes to a tab's mutable fields.
   * Emits `tab.updated` after patching.
   */
  patch(id: string, changes: TabPatch): TabMeta | undefined {
    const tab = this._store.patch(id, changes);
    if (tab) this.events.emit('tab.updated', { tab });
    return tab;
  }

  /**
   * Persist the latest XML + viewport for a tab (called before switching away).
   * Now async — awaits the store backend to confirm the write.
   */
  async snapshot(id: string, xml: string, viewbox: ViewboxSnapshot | null): Promise<void> {
    this._store.patch(id, { viewbox });
    await this._store.saveXml(id, xml);
  }

  /**
   * Load the full diagram state including XML for a tab.
   * XML is fetched from the store backend (may be async for non-memory backends).
   *
   * @example
   * const { xml, title } = await manager.loadTab(tab.id);
   * await modeler.importXML(xml);
   */
  async loadTab(id: string): Promise<DiagramTabState | undefined> {
    const meta = this._store.get(id);
    if (!meta) return undefined;
    const xml = await this._store.loadXml(id);
    return { ...meta, xml };
  }

  /**
   * Load only the XML content for a tab.
   * Prefer `loadTab()` when you also need metadata.
   */
  async loadXml(id: string): Promise<string> {
    return this._store.loadXml(id);
  }

  /**
   * Transition a tab's lifecycle state.
   * Emits `tab.lifecycle` with the previous state for diff-checking.
   */
  setLifecycle(id: string, lifecycle: TabLifecycle): void {
    const tab = this._store.get(id);
    if (!tab) return;
    const prev = tab.lifecycle;
    this._store.patch(id, { lifecycle });
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
   * The tab bar UI is responsible for re-rendering; no event is emitted.
   */
  move(id: string, toIndex: number): boolean {
    return this._store.move(id, toIndex);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  /** Get lightweight metadata for a single tab (no XML). */
  get(id: string): TabMeta | undefined {
    return this._store.get(id);
  }

  /** Get lightweight metadata for the currently active tab (no XML). */
  getActive(): TabMeta | undefined {
    return this._store.getActive();
  }

  getActiveId(): string | null {
    return this._store.getActiveId();
  }

  /** Returns all tabs in their current display order (lightweight metadata only). */
  getAll(): TabMeta[] {
    return this._store.getAll();
  }

  getAdjacentTo(id: string): TabMeta | undefined {
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
   * Remove all tabs, dispose the store backend, and reset the event bus.
   * Useful for testing or full reset scenarios.
   */
  dispose(): void {
    for (const tab of this._store.getAll()) {
      this._store.remove(tab.id);
    }
    this._store.dispose();
    this.events.clear();
    this._beforeActivate = null;
  }
}
