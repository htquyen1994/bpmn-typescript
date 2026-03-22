// =============================================================================
// Multi-diagram tab management — shared type definitions
// =============================================================================

// ── Viewport ──────────────────────────────────────────────────────────────────

/** Snapshot of the bpmn-js canvas viewport (zoom + scroll). */
export interface ViewboxSnapshot {
  readonly x:      number;
  readonly y:      number;
  readonly width:  number;
  readonly height: number;
}

// ── Tab state ─────────────────────────────────────────────────────────────────

/** Lifecycle state of a diagram tab. */
export type TabLifecycle =
  | 'idle'      // tab created, diagram not yet loaded
  | 'loading'   // diagram is being imported
  | 'ready'     // diagram fully loaded and interactive
  | 'error';    // last import failed

/**
 * Lightweight tab metadata — always kept in memory for instant UI rendering.
 * Does NOT include XML content (fetched lazily via `TabManager.loadXml()`).
 */
export interface TabMeta {
  /** Unique tab identifier — assigned at creation, never changes. */
  readonly id:        string;
  /** Unique numeric index used for default title generation. */
  readonly index:     number;
  /** Human-readable tab label. */
  title:              string;
  /** True when the diagram has unsaved / un-snapshotted changes. */
  isDirty:            boolean;
  /** Current lifecycle phase. */
  lifecycle:          TabLifecycle;
  /** Last known viewport — null until the tab is first activated. */
  viewbox:            ViewboxSnapshot | null;
  /** Unix timestamp (ms) when this tab was created. */
  readonly createdAt: number;
  /** Arbitrary consumer-defined data attached to this tab. */
  metadata:           Record<string, unknown>;
}

/**
 * Full tab state including XML content.
 * Returned by `TabManager.loadTab()` when the diagram XML has been explicitly fetched.
 *
 * @see TabManager.loadTab
 */
export interface DiagramTabState extends TabMeta {
  /** Full BPMN 2.0 XML — includes extensionElements for custom properties. */
  xml: string;
}

/** Fields that may be patched on an existing tab (id, index, createdAt are immutable). */
export type TabPatch = Partial<Omit<TabMeta, 'id' | 'index' | 'createdAt'>>;

// ── Configuration ─────────────────────────────────────────────────────────────

/** Options for creating a new tab. */
export interface AddTabConfig {
  /** Display name. Defaults to "<defaultTitle> N". */
  title?:    string;
  /** Initial BPMN XML. Saved to the store backend immediately on creation. */
  xml?:      string;
  /** Initial viewport. Defaults to null (fit-viewport on first load). */
  viewbox?:  ViewboxSnapshot;
  /** Arbitrary metadata to attach to the tab. */
  metadata?: Record<string, unknown>;
}

/** Options passed to `TabManager` at construction time. */
export interface TabManagerConfig {
  /** Maximum number of simultaneously open tabs. Default: unlimited. */
  maxTabs?:      number;
  /** Prefix for auto-generated tab titles. Default: `'Diagram'`. */
  defaultTitle?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Called synchronously or asynchronously before a tab is activated.
 * Return `false` (or `Promise<false>`) to cancel the activation.
 *
 * @example
 * tabManager.setBeforeActivate(async (current, _next) => {
 *   if (!current?.isDirty) return true;
 *   return confirm(`"${current.title}" has unsaved changes. Switch anyway?`);
 * });
 */
export type BeforeActivateHook = (
  current: TabMeta | null,
  next:    TabMeta,
) => boolean | Promise<boolean>;

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * Typed event map for the tab system.
 * Keys are event names; values are the payload shapes.
 */
export interface TabEventMap {
  /** A new tab was added to the store. */
  'tab.added':      { readonly tab: TabMeta };
  /**
   * A tab was removed from the store.
   * `adjacent` is the tab that should be activated next, or null if no tabs remain.
   */
  'tab.removed':    { readonly tab: TabMeta; readonly adjacent: TabMeta | null };
  /** A tab switch completed successfully. */
  'tab.activated':  { readonly prev: TabMeta | null; readonly next: TabMeta };
  /** A tab's mutable fields were patched (title, isDirty, lifecycle, …). */
  'tab.updated':    { readonly tab: TabMeta };
  /** A tab's `isDirty` flag changed from false → true. */
  'tab.dirtied':    { readonly tab: TabMeta };
  /** A tab's `isDirty` flag changed from true → false (after snapshot / save). */
  'tab.cleaned':    { readonly tab: TabMeta };
  /** A tab's lifecycle changed (idle → loading → ready / error). */
  'tab.lifecycle':  { readonly tab: TabMeta; readonly prev: TabLifecycle };
}

/** Union of all valid event names. */
export type TabEvent = keyof TabEventMap;
