import type { SubprocessStore, SubprocessItem } from './subprocess-store.js';
import type { SubprocessSource }                 from './subprocess-source.js';
import type { BpmnCanvas, BpmnEventBus }         from '../../studio/bpmn-modeler-extender.js';
import type { BpmnPopupMenu }                    from '../../core/bpmn-types.js';

// ── Inline CSS ─────────────────────────────────────────────────────────────────
// Injected once into the document so section headings look like section headings,
// not like disabled menu items.

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
 * Renders two (or more) labelled sections in the popup body:
 *
 *  ┌─────────────────────────────────────┐
 *  │ [Import XML…]          ← header     │
 *  ├─────────────────────────────────────┤
 *  │ IMPORTED SUBPROCESSES   ← section   │
 *  │   ▸ My Process                      │
 *  │   ▸ Order Flow                      │
 *  ├─────────────────────────────────────┤
 *  │ OPEN DIAGRAMS           ← section   │
 *  │   ▸ Diagram 2                       │
 *  │   ▸ Diagram 3                       │
 *  └─────────────────────────────────────┘
 *
 * Additional sources (e.g. TabDiagramSource) are appended after the built-in
 * store section by passing them via `config.subprocessSources` in the Modeler
 * constructor — the plugin never needs to be modified.
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
  private readonly _eventBus: BpmnEventBus;
  private readonly _extraSources: SubprocessSource[];

  constructor(
    popupMenu:     BpmnPopupMenu,
    subprocessStore: SubprocessStore,
    eventBus:      BpmnEventBus,
    canvas:        BpmnCanvas,
    extraSources:  SubprocessSource[] | null = null,
  ) {
    popupMenu.registerProvider('reusable-subprocess', 1500, this);
    this._subprocessStore = subprocessStore;
    this._eventBus        = eventBus;
    this._extraSources    = extraSources ?? [];

    // Inject section styling once per document
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

    // Section 1 — Imported SubProcesses (always first)
    this._appendSection(
      entries,
      'imported',
      'Imported SubProcesses',
      this._subprocessStore.getAll(),
      eventBus,
      /* isFirst */ true,
    );

    // Section 2+ — Extra sources registered via config.subprocessSources
    for (const source of this._extraSources) {
      const key = source.label.toLowerCase().replace(/[\s/]+/g, '-');
      this._appendSection(entries, key, source.label, source.getItems(), eventBus);
    }

    return entries;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Append one labelled section to the entries object.
   * `isFirst` removes the top border on the very first heading.
   */
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
