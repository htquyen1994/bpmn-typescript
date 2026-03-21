// @ts-ignore – Vite ?raw resolves at build time
import zoomInIcon from './icons/zoom-in.svg?raw';
// @ts-ignore
import zoomOutIcon from './icons/zoom-out.svg?raw';
// @ts-ignore
import zoomFitIcon from './icons/zoom-fit.svg?raw';
// @ts-ignore
import exportSvgIcon from './icons/export-svg.svg?raw';
// @ts-ignore
import minimapIcon from './icons/minimap.svg?raw';
// @ts-ignore
import themeIcon from './icons/theme.svg?raw';

import { UIComponent } from '../../core/ui-component.js';

export interface CanvasControlsCallbacks {
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomFit(): void;
  onZoomReset(): void;
  onExportSvg(): Promise<void>;
  onToggleMinimap?(): boolean;
  onToggleTheme?(): boolean;
}

/**
 * Floating control bar at the bottom-left of the canvas.
 * Groups: [ − | 1:1 | + ] [ ⊡ ] [ ↓SVG ] [ minimap? ] [ theme? ]
 *
 * Extends UIComponent — DOM is built lazily on first `mount()`.
 */
export class CanvasControls extends UIComponent {
  private _minimapSep: HTMLElement | null = null;
  private _minimapBtn: HTMLButtonElement | null = null;
  private _themeSep: HTMLElement | null = null;
  private _themeBtn: HTMLButtonElement | null = null;

  constructor(private readonly _cb: CanvasControlsCallbacks) {
    super();
  }

  /** Show or hide the minimap toggle button (and its separator). */
  setMinimapSupported(supported: boolean): void {
    const display = supported ? '' : 'none';
    if (this._minimapSep) this._minimapSep.style.display = display;
    if (this._minimapBtn) this._minimapBtn.style.display = display;
  }

  /** Show or hide the theme toggle button (and its separator). */
  setThemeSupported(supported: boolean): void {
    const display = supported ? '' : 'none';
    if (this._themeSep) this._themeSep.style.display = display;
    if (this._themeBtn) this._themeBtn.style.display = display;
  }

  protected _build(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'csp-canvas-controls';

    const btn = (title: string, icon: string, handler: () => void) => {
      const b = document.createElement('button');
      b.className = 'csp-canvas-btn';
      b.title = title;
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
    resetBtn.title = 'Reset zoom to 100%';
    resetBtn.textContent = '1:1';
    resetBtn.addEventListener('click', this._cb.onZoomReset);

    this._minimapSep = sep();
    this._minimapSep.style.display = 'none';

    this._minimapBtn = document.createElement('button');
    this._minimapBtn.className = 'csp-canvas-btn';
    this._minimapBtn.title = 'Toggle minimap';
    this._minimapBtn.innerHTML = minimapIcon as string;
    this._minimapBtn.style.display = 'none';
    this._minimapBtn.addEventListener('click', () => {
      const isOpen = this._cb.onToggleMinimap?.() ?? false;
      this._minimapBtn!.classList.toggle('csp-canvas-btn--active', isOpen);
    });

    this._themeSep = sep();
    this._themeSep.style.display = 'none';

    this._themeBtn = document.createElement('button');
    this._themeBtn.className = 'csp-canvas-btn';
    this._themeBtn.title = 'Toggle modern theme';
    this._themeBtn.innerHTML = themeIcon as string;
    this._themeBtn.style.display = 'none';
    this._themeBtn.addEventListener('click', () => {
      const isActive = this._cb.onToggleTheme?.() ?? false;
      this._themeBtn!.classList.toggle('csp-canvas-btn--active', isActive);
    });

    bar.append(
      btn('Zoom Out', zoomOutIcon as string, this._cb.onZoomOut),
      resetBtn,
      btn('Zoom In', zoomInIcon as string, this._cb.onZoomIn),
      sep(),
      btn('Fit to viewport', zoomFitIcon as string, this._cb.onZoomFit),
      sep(),
      btn('Export SVG', exportSvgIcon as string, () => void this._cb.onExportSvg()),
      this._minimapSep,
      this._minimapBtn,
      this._themeSep,
      this._themeBtn,
    );

    return bar;
  }
}
