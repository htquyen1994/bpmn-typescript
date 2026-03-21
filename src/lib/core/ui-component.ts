/**
 * Abstract base class for all custom UI widgets (CanvasControls, TabBarUI, …).
 *
 * Lifecycle:
 *   1. Constructor — receive dependencies, call `super()`.
 *   2. `mount(parent)` — builds DOM via `_build()`, appends to parent, calls `_onMounted()`.
 *   3. `destroy()` — runs cleanup functions registered with `addCleanup()`, removes root.
 *
 * Design: Template Method pattern.
 *   Subclasses implement `_build()` (required) and optionally `_onMounted()`.
 */
export abstract class UIComponent {
  protected _root: HTMLElement | null = null;
  private readonly _cleanups: Array<() => void> = [];

  /** Append the component to `parent`. Builds the DOM on first call. */
  mount(parent: HTMLElement): void {
    if (!this._root) this._root = this._build();
    parent.appendChild(this._root);
    this._onMounted();
  }

  /** Remove from DOM and run all registered cleanup functions. */
  destroy(): void {
    for (const fn of this._cleanups) fn();
    this._cleanups.length = 0;
    this._root?.remove();
    this._root = null;
  }

  /** Build and return the root DOM element. Called once before the first mount. */
  protected abstract _build(): HTMLElement;

  /** Optional hook called after the root is appended to the DOM. */
  protected _onMounted(): void {}

  /**
   * Register a teardown function to run on `destroy()`.
   * Use for event listener removals, interval clears, etc.
   */
  protected addCleanup(fn: () => void): void {
    this._cleanups.push(fn);
  }

  /**
   * Inject a `<style>` tag into `doc.head` exactly once, keyed by `id`.
   * Safe to call multiple times — subsequent calls with the same `id` are no-ops.
   */
  protected injectStyles(doc: Document, id: string, css: string): void {
    if (doc.head.querySelector(`[data-csp-ui="${id}"]`)) return;
    const style = doc.createElement('style');
    style.setAttribute('data-csp-ui', id);
    style.textContent = css;
    doc.head.appendChild(style);
  }
}
