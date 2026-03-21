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

/** Immutable identity of a tab plus its mutable runtime state. */
export interface DiagramTabState {
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
  /** Full BPMN 2.0 XML — includes extensionElements for custom properties. */
  xml:                string;
  /** Last known viewport — null until the tab is first activated. */
  viewbox:            ViewboxSnapshot | null;
  /** Unix timestamp (ms) when this tab was created. */
  readonly createdAt: number;
  /** Arbitrary consumer-defined data attached to this tab. */
  metadata:           Record<string, unknown>;
}

// ── Configuration ─────────────────────────────────────────────────────────────

/** Options for creating a new tab. */
export interface AddTabConfig {
  /** Display name. Defaults to "<defaultTitle> N". */
  title?:    string;
  /** Initial BPMN XML. Defaults to an empty diagram. */
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
 * // Prevent switching away from a dirty tab without confirmation
 * tabManager.setBeforeActivate(async (current, _next) => {
 *   if (!current?.isDirty) return true;
 *   return confirm(`"${current.title}" has unsaved changes. Switch anyway?`);
 * });
 */
export type BeforeActivateHook = (
  current: DiagramTabState | null,
  next:    DiagramTabState,
) => boolean | Promise<boolean>;

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * Typed event map for the tab system.
 * Keys are event names; values are the payload shapes.
 */
export interface TabEventMap {
  /** A new tab was added to the store. */
  'tab.added':      { readonly tab: DiagramTabState };
  /**
   * A tab was removed from the store.
   * `adjacent` is the tab that should be activated next, or null if no tabs remain.
   */
  'tab.removed':    { readonly tab: DiagramTabState; readonly adjacent: DiagramTabState | null };
  /** A tab switch completed successfully. */
  'tab.activated':  { readonly prev: DiagramTabState | null; readonly next: DiagramTabState };
  /** A tab's mutable fields were patched (title, isDirty, lifecycle, …). */
  'tab.updated':    { readonly tab: DiagramTabState };
  /** A tab's `isDirty` flag changed from false → true. */
  'tab.dirtied':    { readonly tab: DiagramTabState };
  /** A tab's `isDirty` flag changed from true → false (after snapshot / save). */
  'tab.cleaned':    { readonly tab: DiagramTabState };
  /** A tab's lifecycle changed (idle → loading → ready / error). */
  'tab.lifecycle':  { readonly tab: DiagramTabState; readonly prev: TabLifecycle };
}

/** Union of all valid event names. */
export type TabEvent = keyof TabEventMap;
