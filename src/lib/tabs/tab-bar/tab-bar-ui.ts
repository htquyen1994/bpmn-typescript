// @ts-ignore – Vite ?inline resolves at build time
import tabBarCss from './tab-bar.css?inline';

import { UIComponent } from '../../core/ui-component.js';
import type { TabManager } from '../tab-manager.js';
import type { DiagramTabState } from '../types.js';

/** Callbacks the tab bar delegates user gestures to. */
export interface TabBarCallbacks {
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, newTitle: string) => void;
}

/**
 * DOM renderer for the Excel-like tab bar.
 *
 * Extends UIComponent — DOM built lazily on first `mount()`.
 * Manager events are subscribed in `_onMounted()` and cleaned up via `addCleanup()`.
 */
export class TabBarUI extends UIComponent {
  private _list!: HTMLElement;

  constructor(
    private readonly _manager: TabManager,
    private readonly _cb: TabBarCallbacks,
  ) {
    super();
  }

  // ── UIComponent hooks ────────────────────────────────────────────────────

  protected _build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'csp-tab-bar';

    this._list = document.createElement('div');
    this._list.className = 'csp-tab-list';
    root.appendChild(this._list);

    const addBtn = document.createElement('button');
    addBtn.className = 'csp-tab-add';
    addBtn.title = 'New diagram tab';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => this._cb.onAdd());
    root.appendChild(addBtn);

    return root;
  }

  protected _onMounted(): void {
    this.injectStyles(
      this._root!.ownerDocument ?? document,
      'csp-tab-bar',
      tabBarCss as string,
    );

    const re = () => this._render();
    for (const ev of [
      'tab.added', 'tab.removed', 'tab.activated',
      'tab.updated', 'tab.dirtied', 'tab.cleaned',
    ] as const) {
      this.addCleanup(this._manager.events.on(ev, re));
    }

    this._render();
  }

  // ── Private – rendering ──────────────────────────────────────────────────

  private _render(): void {
    const tabs = this._manager.getAll();
    const activeId = this._manager.getActiveId();

    this._list.innerHTML = '';
    for (const tab of tabs) {
      this._list.appendChild(this._createTabEl(tab, tab.id === activeId));
    }

    if (activeId) {
      const activeEl = this._list.querySelector(
        `[data-tab-id="${activeId}"]`,
      ) as HTMLElement | null;
      activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  private _createTabEl(tab: DiagramTabState, isActive: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = 'csp-tab' + (isActive ? ' csp-tab--active' : '');
    el.dataset.tabId = tab.id;
    el.title = tab.title;

    if (tab.isDirty) {
      const dot = document.createElement('span');
      dot.className = 'csp-tab-dirty';
      el.appendChild(dot);
    }

    const label = document.createElement('span');
    label.className = 'csp-tab-label';
    label.textContent = tab.title;
    el.appendChild(label);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'csp-tab-close';
    closeBtn.title = 'Close tab';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._cb.onClose(tab.id);
    });
    el.appendChild(closeBtn);

    el.addEventListener('click', () => this._cb.onActivate(tab.id));
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this._startInlineRename(el, label, tab);
    });

    return el;
  }

  // ── Inline rename ────────────────────────────────────────────────────────

  private _startInlineRename(
    tabEl: HTMLElement,
    labelEl: HTMLSpanElement,
    tab: DiagramTabState,
  ): void {
    const doc = tabEl.ownerDocument;
    const input = doc.createElement('input');

    input.value = tab.title;
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
      labelEl.textContent = newTitle;
      input.replaceWith(labelEl);
      if (newTitle !== tab.title) this._cb.onRename(tab.id, newTitle);
    };

    labelEl.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = tab.title; input.blur(); }
    });
  }
}
