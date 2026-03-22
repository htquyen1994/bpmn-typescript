// =============================================================================
// LoadingOverlay — reusable, reference-counted loading UI
//
// Designed to be shared across features: tab switching, file import, API calls.
// Reference counting ensures nested show/hide calls are balanced — the overlay
// only disappears when every caller has called hide().
//
// CSS Variables (theme-able):
//   --csp-loading-bg         backdrop colour  (default: rgba(0,0,0,0.30))
//   --csp-loading-color      spinner colour   (default: #ffffff)
//   --csp-loading-track      spinner track    (default: rgba(255,255,255,0.20))
//   --csp-loading-text       message colour   (default: rgba(255,255,255,0.90))
//   --csp-loading-font-size  message size     (default: 13px)
//
// @example
//   const overlay = new LoadingOverlay();
//   overlay.mount(canvasContainer);
//
//   overlay.show('Switching diagram…');
//   await doHeavyWork();
//   overlay.hide();
//
// Nested usage:
//   overlay.show('Importing…');   // depth = 1
//   overlay.show('Parsing XML…'); // depth = 2, still visible
//   overlay.hide();               // depth = 1, still visible
//   overlay.hide();               // depth = 0, hides
// =============================================================================

// @ts-ignore – Vite ?inline resolves at build time
import overlayCSS from './loading-overlay.css?inline';

export class LoadingOverlay {
  private _root:   HTMLElement | null = null;
  private _msgEl:  HTMLElement | null = null;
  /** Reference count — overlay is visible while > 0. */
  private _depth = 0;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Build and attach the overlay DOM inside `container`.
   * The container must have `position: relative` (or any non-static position)
   * for the absolute overlay to fill it correctly.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  mount(container: Element): void {
    if (this._root) return;

    this._injectStyles(container.ownerDocument ?? document);

    this._root = document.createElement('div');
    this._root.className = 'csp-loading-overlay';
    this._root.setAttribute('role', 'status');
    this._root.setAttribute('aria-live', 'polite');
    this._root.setAttribute('aria-hidden', 'true');

    const spinner = document.createElement('div');
    spinner.className = 'csp-loading-spinner';

    this._msgEl = document.createElement('span');
    this._msgEl.className = 'csp-loading-message';

    this._root.append(spinner, this._msgEl);
    container.append(this._root);
  }

  /** Remove the overlay element and reset internal state. */
  destroy(): void {
    this._root?.remove();
    this._root  = null;
    this._msgEl = null;
    this._depth = 0;
  }

  // ── Show / Hide ──────────────────────────────────────────────────────────────

  /**
   * Increment the reference count and show the overlay.
   * Must be paired with a matching `hide()` call.
   *
   * @param message  Optional label rendered below the spinner.
   */
  show(message = ''): void {
    this._depth++;
    if (this._msgEl) this._msgEl.textContent = message;
    this._sync();
  }

  /**
   * Decrement the reference count.
   * The overlay hides only when the count reaches zero.
   */
  hide(): void {
    this._depth = Math.max(0, this._depth - 1);
    this._sync();
  }

  /**
   * Immediately hide the overlay regardless of reference count.
   * Use only for error recovery paths.
   */
  forceHide(): void {
    this._depth = 0;
    this._sync();
  }

  /** Update the message text without changing visibility. */
  setMessage(message: string): void {
    if (this._msgEl) this._msgEl.textContent = message;
  }

  isVisible(): boolean {
    return this._depth > 0;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _sync(): void {
    if (!this._root) return;
    const visible = this._depth > 0;
    this._root.classList.toggle('csp-loading-overlay--visible', visible);
    this._root.setAttribute('aria-hidden', String(!visible));
  }

  private _injectStyles(doc: Document): void {
    const id = 'csp-loading-overlay';
    if (doc.head.querySelector(`[data-csp-ui="${id}"]`)) return;
    const style = doc.createElement('style');
    style.setAttribute('data-csp-ui', id);
    style.textContent = overlayCSS as string;
    doc.head.appendChild(style);
  }
}
