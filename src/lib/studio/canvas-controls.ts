// ── Inline SVG icons ──────────────────────────────────────────────────────────

const ICON_ZOOM_OUT = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
  <circle cx="6.5" cy="6.5" r="4.5"/>
  <line x1="4" y1="6.5" x2="9" y2="6.5"/>
  <line x1="10.5" y1="10.5" x2="14" y2="14"/>
</svg>`;

const ICON_ZOOM_IN = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
  <circle cx="6.5" cy="6.5" r="4.5"/>
  <line x1="4" y1="6.5" x2="9" y2="6.5"/>
  <line x1="6.5" y1="4" x2="6.5" y2="9"/>
  <line x1="10.5" y1="10.5" x2="14" y2="14"/>
</svg>`;

const ICON_FIT = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="5,1 1,1 1,5"/>
  <polyline points="11,1 15,1 15,5"/>
  <polyline points="5,15 1,15 1,11"/>
  <polyline points="11,15 15,15 15,11"/>
</svg>`;

const ICON_EXPORT_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="8" y1="2" x2="8" y2="11"/>
  <polyline points="5,8 8,11 11,8"/>
  <line x1="2" y1="14" x2="14" y2="14"/>
</svg>`;

// ── Callbacks ─────────────────────────────────────────────────────────────────

export interface CanvasControlsCallbacks {
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomFit(): void;
  onZoomReset(): void;
  onExportSvg(): Promise<void>;
}

// ── CanvasControls ────────────────────────────────────────────────────────────

/**
 * Floating control bar rendered at the bottom-right of the canvas container.
 * Groups: [ − | 1:1 | + ] [ ⊡ ] [ ↓SVG ]
 */
export class CanvasControls {
  private _el: HTMLElement | null = null;

  /** Append the control bar inside `parent` and wire all callbacks. */
  mount(parent: HTMLElement, callbacks: CanvasControlsCallbacks): void {
    this._el = this._build(callbacks);
    parent.appendChild(this._el);
  }

  destroy(): void {
    this._el?.remove();
    this._el = null;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _build(cbs: CanvasControlsCallbacks): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'csp-canvas-controls';

    const btn = (title: string, icon: string, handler: () => void, extraClass = '') => {
      const b = document.createElement('button');
      b.className = 'csp-canvas-btn' + (extraClass ? ` ${extraClass}` : '');
      b.title     = title;
      b.innerHTML = icon;
      b.addEventListener('click', handler);
      return b;
    };

    const sep = () => {
      const s = document.createElement('div');
      s.className = 'csp-canvas-sep';
      return s;
    };

    const resetBtn = document.createElement('button');
    resetBtn.className = 'csp-canvas-btn csp-canvas-btn--text';
    resetBtn.title     = 'Reset zoom to 100%';
    resetBtn.textContent = '1:1';
    resetBtn.addEventListener('click', cbs.onZoomReset);

    bar.append(
      btn('Zoom Out', ICON_ZOOM_OUT, cbs.onZoomOut),
      resetBtn,
      btn('Zoom In', ICON_ZOOM_IN, cbs.onZoomIn),
      sep(),
      btn('Fit to viewport', ICON_FIT, cbs.onZoomFit),
      sep(),
      btn('Export SVG', ICON_EXPORT_SVG, () => void cbs.onExportSvg()),
    );

    return bar;
  }
}
