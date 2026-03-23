import type { SubprocessStore, SubprocessItem } from './subprocess-store.js';
import type { SubprocessSource }                 from './subprocess-source.js';
import type { BpmnCanvas, BpmnEventBus }         from '../../studio/bpmn-modeler-extender.js';
import type { BpmnPopupMenu }                    from '../../core/bpmn-types.js';

// ── Inline CSS ─────────────────────────────────────────────────────────────────

const SECTION_CSS = `
.djs-popup .entry.csp-popup-sp-section-header {
  font-size:       10px !important;
  font-weight:     700  !important;
  text-transform:  uppercase;
  letter-spacing:  0.07em;
  color:           var(--csp-text-muted, #888) !important;
  background:      transparent !important;
  border-top:      1px solid var(--csp-border, rgba(0,0,0,0.09));
  padding-top:     7px  !important;
  margin-top:      2px;
  cursor:          default;
  pointer-events:  none;
  opacity:         1 !important;
}
.djs-popup .entry.csp-popup-sp-section-first {
  border-top:  none !important;
  margin-top:  0    !important;
  padding-top: 4px  !important;
}
.djs-popup .entry.csp-popup-sp-empty {
  color:          var(--csp-text-muted, #aaa) !important;
  font-style:     italic;
  font-size:      12px !important;
  pointer-events: none;
  opacity:        1    !important;
}
`;

/**
 * Registers a popup-menu provider under the key `'reusable-subprocess'`.
 *
 * Sections rendered:
 *
 *  ┌─────────────────────────────────────┐
 *  │ [Import XML…]          ← header     │
 *  ├─────────────────────────────────────┤
 *  │ IMPORTED SUBPROCESSES   ← section   │
 *  │   ▸ My Process                      │
 *  ├─────────────────────────────────────┤
 *  │ OPEN DIAGRAMS           ← section   │  only when TabManagerModule registered
 *  │   ▸ Diagram 2                       │
 *  ├─────────────────────────────────────┤
 *  │ CUSTOM SOURCE           ← section   │  any config.subprocessSources entries
 *  │   ▸ Template A                      │
 *  └─────────────────────────────────────┘
 *
 * "Open Diagrams" is driven by SubprocessStore.getTabItems() which is kept
 * in sync automatically via the 'tabs.changed' eventBus event when
 * TabManagerModule is registered. No manual SubprocessSource config needed.
 *
 * Additional external sources (API catalogs, template libraries, etc.) can
 * still be registered via config.subprocessSources for backwards compatibility.
 */
export class SubprocessPopupProvider {
  static $inject = [
    'popupMenu',
    'subprocessStore',
    'eventBus',
    'canvas',
    'config.subprocessSources',
  ];

  private readonly _subprocessStore: SubprocessStore;
  private readonly _eventBus:        BpmnEventBus;
  private readonly _extraSources:    SubprocessSource[];

  constructor(
    popupMenu:       BpmnPopupMenu,
    subprocessStore: SubprocessStore,
    eventBus:        BpmnEventBus,
    canvas:          BpmnCanvas,
    extraSources:    SubprocessSource[] | null = null,
  ) {
    popupMenu.registerProvider('reusable-subprocess', 1500, this);
    this._subprocessStore = subprocessStore;
    this._eventBus        = eventBus;
    this._extraSources    = extraSources ?? [];

    this._injectStyles(canvas.getContainer().ownerDocument ?? document);
  }

  // ── bpmn-js popup provider API ───────────────────────────────────────────────

  getPopupMenuHeaderEntries(): Record<string, object> {
    const eventBus = this._eventBus;
    return {
      'sp-import': {
        label:     'Import XML…',
        className: 'csp-popup-import-sp',
        title:     'Load a new SubProcess from a .bpmn file',
        action() {
          eventBus.fire('subprocess.import-request');
        },
      },
    };
  }

  getPopupMenuEntries(): Record<string, object> {
    const entries:  Record<string, object> = {};
    const eventBus = this._eventBus;

    // Section 1 — File-imported SubProcesses (always first)
    this._appendSection(
      entries,
      'imported',
      'Imported SubProcesses',
      this._subprocessStore.getImportedItems(),
      eventBus,
      /* isFirst */ true,
    );

    // Section 2 — Open diagram tabs (auto-synced via EventBus bridge)
    // Only shown when TabManagerModule is registered.
    if (this._subprocessStore.hasTabIntegration) {
      this._appendSection(
        entries,
        'open-diagrams',
        'Open Diagrams',
        this._subprocessStore.getTabItems(),
        eventBus,
      );
    }

    // Section 3+ — External sources registered via config.subprocessSources
    // (kept for non-tab sources: API catalogs, template libraries, etc.)
    for (const source of this._extraSources) {
      const key = source.label.toLowerCase().replace(/[\s/]+/g, '-');
      this._appendSection(entries, key, source.label, source.getItems(), eventBus);
    }

    return entries;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _appendSection(
    entries:  Record<string, object>,
    key:      string,
    label:    string,
    items:    SubprocessItem[],
    eventBus: BpmnEventBus,
    isFirst = false,
  ): void {
    const headingClass = isFirst
      ? 'csp-popup-sp-section-header csp-popup-sp-section-first'
      : 'csp-popup-sp-section-header';

    entries[`_h_${key}`] = {
      label,
      className: headingClass,
      disabled:  true,
      action()   { /* section heading — no-op */ },
    };

    if (items.length === 0) {
      entries[`_empty_${key}`] = {
        label:     'None',
        className: 'csp-popup-sp-empty',
        disabled:  true,
        action()   {},
      };
      return;
    }

    for (const item of items) {
      const captured: SubprocessItem = item;
      entries[`sp-${captured.storeId}`] = {
        label:     captured.name,
        className: 'bpmn-icon-subprocess-collapsed',
        title:     `Place "${captured.name}" as a collapsed SubProcess`,
        action() {
          eventBus.fire('subprocess.create', { item: captured });
        },
      };
    }
  }

  private _injectStyles(doc: Document): void {
    const id = 'csp-subprocess-popup-sections';
    if (doc.head.querySelector(`[data-csp-ui="${id}"]`)) return;
    const style = doc.createElement('style');
    style.setAttribute('data-csp-ui', id);
    style.textContent = SECTION_CSS;
    doc.head.appendChild(style);
  }
}
