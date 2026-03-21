// @ts-ignore – ?inline is resolved by Vite at build time
import modernCss from './themes/modern.css?inline';

const MODERN_CLASS = 'csp-theme-modern';
const MODERN_STYLE_ID = 'csp-diagram-theme-modern';

/**
 * Manages the active diagram theme by toggling a CSS class on the bpmn-js
 * canvas container element.
 *
 * Themes are implemented as CSS-only: a class is added to the container and
 * all theme rules are scoped under that class.  This means:
 *  - Theme changes are instant (no re-import of XML).
 *  - Theme survives tab switches and modeler re-creations.
 *  - No bpmn-js renderer customisation is needed.
 *
 * Usage:
 *   const themer = new DiagramThemeManager();
 *   themer.mount(canvasContainerEl);  // call once after layout is built
 *   themer.toggle();                  // switch between default ↔ modern
 */
export class DiagramThemeManager {
  private _active = false;
  private _container: HTMLElement | null = null;

  /**
   * Attach to the canvas container element and inject the modern-theme CSS
   * once into the document head (idempotent — safe to call on each reconnect).
   */
  mount(container: HTMLElement): void {
    this._container = container;
    this._injectCSS();
    // Re-apply current state (handles modeler destroy/recreate cycles).
    this._apply();
  }

  /**
   * Toggle between default (no class) and the modern theme.
   * @returns `true` when the modern theme is now active.
   */
  toggle(): boolean {
    this._active = !this._active;
    this._apply();
    return this._active;
  }

  /** Whether the modern theme is currently active. */
  get isActive(): boolean { return this._active; }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _apply(): void {
    this._container?.classList.toggle(MODERN_CLASS, this._active);
  }

  private _injectCSS(): void {
    if (document.head.querySelector(`[data-csp-id="${MODERN_STYLE_ID}"]`)) return;
    const style = document.createElement('style');
    style.setAttribute('data-csp-id', MODERN_STYLE_ID);
    style.textContent = modernCss as string;
    document.head.appendChild(style);
  }
}
