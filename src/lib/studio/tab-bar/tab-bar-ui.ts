// =============================================================================
// TabBarUI — DOM renderer for the Excel-like tab bar
//
// Responsibilities:
//   • Render all open tabs in order, with dirty indicator, label, close button
//   • Scroll the active tab into view automatically
//   • Handle click (activate), double-click (inline rename), close button (remove)
//   • "+" button to open a new blank tab
//   • Subscribe to TabManager events so the bar stays in sync without manual calls
// =============================================================================

import { TAB_BAR_STYLES } from './tab-bar-styles.js';
import type { TabManager }       from '../../multi/tab-manager.js';
import type { DiagramTabState }  from '../../multi/types.js';

/** Callbacks the tab bar delegates user gestures to. */
export interface TabBarCallbacks {
  /** User clicked a tab to switch to it. */
  onActivate: (id: string) => void;
  /** User clicked the × button on a tab. */
  onClose:    (id: string) => void;
  /** User clicked the + button. */
  onAdd:      () => void;
  /** User finished an inline rename (double-click). */
  onRename:   (id: string, newTitle: string) => void;
}

export class TabBarUI {
  private readonly _root:    HTMLElement;
  private readonly _list:    HTMLElement;
  private readonly _addBtn:  HTMLButtonElement;
  private readonly _manager: TabManager;
  private readonly _cb:      TabBarCallbacks;
  private readonly _unsubs:  Array<() => void> = [];
  private _styleInjected = false;

  constructor(manager: TabManager, callbacks: TabBarCallbacks) {
    this._manager = manager;
    this._cb      = callbacks;

    // ── Root bar ───────────────────────────────────────────────────────────────
    this._root = document.createElement('div');
    this._root.className = 'csp-tab-bar';

    // ── Scrollable tab list ────────────────────────────────────────────────────
    this._list = document.createElement('div');
    this._list.className = 'csp-tab-list';
    this._root.appendChild(this._list);

    // ── Add-tab button ─────────────────────────────────────────────────────────
    this._addBtn = document.createElement('button');
    this._addBtn.className   = 'csp-tab-add';
    this._addBtn.title       = 'New diagram tab';
    this._addBtn.textContent = '+';
    this._addBtn.addEventListener('click', () => this._cb.onAdd());
    this._root.appendChild(this._addBtn);

    this._subscribeToManager();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Append the tab bar to a container element and perform an initial render. */
  mount(container: HTMLElement): void {
    this._injectStyles(container.ownerDocument ?? document);
    container.appendChild(this._root);
    this._render();
  }

  /** Remove DOM node and detach all event listeners. */
  destroy(): void {
    for (const unsub of this._unsubs) unsub();
    this._unsubs.length = 0;
    this._root.remove();
  }

  // ── Private – event subscriptions ─────────────────────────────────────────

  private _subscribeToManager(): void {
    const re = (): void => this._render();
    this._unsubs.push(
      this._manager.events.on('tab.added',     re),
      this._manager.events.on('tab.removed',   re),
      this._manager.events.on('tab.activated', re),
      this._manager.events.on('tab.updated',   re),
      this._manager.events.on('tab.dirtied',   re),
      this._manager.events.on('tab.cleaned',   re),
    );
  }

  // ── Private – rendering ────────────────────────────────────────────────────

  private _injectStyles(doc: Document): void {
    if (this._styleInjected) return;
    if (doc.head.querySelector('[data-csp-tab-bar-styles]')) {
      this._styleInjected = true;
      return;
    }
    const style = doc.createElement('style');
    style.setAttribute('data-csp-tab-bar-styles', '');
    style.textContent = TAB_BAR_STYLES;
    doc.head.appendChild(style);
    this._styleInjected = true;
  }

  private _render(): void {
    const tabs     = this._manager.getAll();
    const activeId = this._manager.getActiveId();

    this._list.innerHTML = '';

    for (const tab of tabs) {
      this._list.appendChild(this._createTabEl(tab, tab.id === activeId));
    }

    // Scroll active tab into view after DOM update.
    if (activeId) {
      const activeEl = this._list.querySelector(
        `[data-tab-id="${activeId}"]`,
      ) as HTMLElement | null;
      activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  private _createTabEl(tab: DiagramTabState, isActive: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className     = 'csp-tab' + (isActive ? ' csp-tab--active' : '');
    el.dataset.tabId = tab.id;
    el.title         = tab.title;

    // Amber dirty-indicator dot
    if (tab.isDirty) {
      const dot = document.createElement('span');
      dot.className = 'csp-tab-dirty';
      el.appendChild(dot);
    }

    // Label
    const label = document.createElement('span');
    label.className   = 'csp-tab-label';
    label.textContent = tab.title;
    el.appendChild(label);

    // Close button (×)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'csp-tab-close';
    closeBtn.title     = 'Close tab';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._cb.onClose(tab.id);
    });
    el.appendChild(closeBtn);

    // Single click → activate
    el.addEventListener('click', () => this._cb.onActivate(tab.id));

    // Double-click → inline rename
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this._startInlineRename(el, label, tab);
    });

    return el;
  }

  // ── Inline rename ─────────────────────────────────────────────────────────

  private _startInlineRename(
    tabEl:   HTMLElement,
    labelEl: HTMLSpanElement,
    tab:     DiagramTabState,
  ): void {
    const doc   = tabEl.ownerDocument;
    const input = doc.createElement('input');

    input.value     = tab.title;
    input.className = 'csp-tab-label';
    input.style.cssText = [
      'border:none',
      'outline:1px solid #4a90d9',
      'background:#fff',
      'padding:0 2px',
      'font:inherit',
      'min-width:40px',
      `width:${Math.max(60, tab.title.length * 7)}px`,
    ].join(';');

    const commit = (): void => {
      const newTitle = input.value.trim() || tab.title;
      // Restore the label span first (re-render from event will reconcile)
      labelEl.textContent = newTitle;
      input.replaceWith(labelEl);
      if (newTitle !== tab.title) {
        this._cb.onRename(tab.id, newTitle);
      }
    };

    labelEl.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener('blur',    commit, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  input.blur();
      if (e.key === 'Escape') { input.value = tab.title; input.blur(); }
    });
  }
}
