// @ts-ignore – Vite ?inline resolves at build time
import tabBarCss  from './tab-bar.css?inline';
// @ts-ignore – Vite ?raw resolves at build time
import shellHtml  from './tab-bar.html?raw';
// @ts-ignore – Vite ?raw resolves at build time
import itemHtml   from './tab-bar-item.html?raw';

import { UIComponent } from '../../core/ui-component.js';
import type { TabManager } from '../tab-manager.js';
import type { TabMeta } from '../types.js';

/** Callbacks the tab bar delegates user gestures to. */
export interface TabBarCallbacks {
  onActivate: (id: string) => void;
  onClose:    (id: string) => void;
  onAdd:      () => void;
  onRename:   (id: string, newTitle: string) => void;
}

/**
 * DOM renderer for the Excel-like tab bar.
 *
 * Layout is defined in `tab-bar.html` / `tab-bar-item.html`.
 * Styles live in `tab-bar.css`.
 * This file contains only event wiring and render logic.
 */
export class TabBarUI extends UIComponent {
  private _list!:         HTMLElement;
  private _itemTemplate!: HTMLElement;

  constructor(
    private readonly _manager: TabManager,
    private readonly _cb:      TabBarCallbacks,
  ) {
    super();
  }

  // ── UIComponent hooks ────────────────────────────────────────────────────

  protected _build(): HTMLElement {
    // ── Shell ──────────────────────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.innerHTML = (shellHtml as string).trim();
    const root = wrapper.firstElementChild as HTMLElement;

    this._list = root.querySelector('.csp-tab-list')!;
    root.querySelector<HTMLButtonElement>('.csp-tab-add')!
        .addEventListener('click', () => this._cb.onAdd());

    // ── Tab item template (parsed once, cloned per tab) ────────────────────
    const tpl = document.createElement('div');
    tpl.innerHTML = (itemHtml as string).trim();
    this._itemTemplate = tpl.firstElementChild as HTMLElement;

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
    const tabs     = this._manager.getAll();
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

  private _createTabEl(tab: TabMeta, isActive: boolean): HTMLElement {
    // Clone the pre-parsed template (structure only — no event listeners)
    const el = this._itemTemplate.cloneNode(true) as HTMLElement;

    el.classList.toggle('csp-tab--active', isActive);
    el.classList.toggle('csp-tab--dirty',  tab.isDirty);
    el.dataset.tabId = tab.id;
    el.title = tab.title;
    el.setAttribute('aria-selected', String(isActive));
    el.setAttribute('tabindex', isActive ? '0' : '-1');

    const label    = el.querySelector<HTMLSpanElement>('.csp-tab-label')!;
    label.textContent = tab.title;

    const closeBtn = el.querySelector<HTMLButtonElement>('.csp-tab-close')!;
    closeBtn.setAttribute('aria-label', `Close "${tab.title}"`);
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._cb.onClose(tab.id);
    });

    el.addEventListener('click', () => this._cb.onActivate(tab.id));
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this._startInlineRename(el, label, tab);
    });

    return el;
  }

  // ── Inline rename ────────────────────────────────────────────────────────

  private _startInlineRename(
    tabEl:   HTMLElement,
    labelEl: HTMLSpanElement,
    tab:     TabMeta,
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
      labelEl.textContent = newTitle;
      input.replaceWith(labelEl);
      if (newTitle !== tab.title) this._cb.onRename(tab.id, newTitle);
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
