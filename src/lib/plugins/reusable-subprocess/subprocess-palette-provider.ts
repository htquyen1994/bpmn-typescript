import type { SubprocessStore } from './subprocess-store.js';
import type { BpmnCanvas, BpmnEventBus } from '../../studio/bpmn-modeler-extender.js';
import type { BpmnPalette, BpmnPopupMenu } from '../../core/bpmn-types.js';

/**
 * Adds two entries to the bpmn-js palette:
 *  - "Reusable SubProcess" – opens the popup menu listing stored items.
 *  - "Import SubProcess XML" – fires `subprocess.import-request` to trigger file picker.
 */
export class SubprocessPaletteProvider {
  static $inject = ['palette', 'subprocessStore', 'popupMenu', 'eventBus', 'canvas'];

  private readonly _subprocessStore: SubprocessStore;
  private readonly _popupMenu: BpmnPopupMenu;
  private readonly _eventBus: BpmnEventBus;
  private readonly _canvas: BpmnCanvas;

  constructor(
    palette: BpmnPalette,
    subprocessStore: SubprocessStore,
    popupMenu: BpmnPopupMenu,
    eventBus: BpmnEventBus,
    canvas: BpmnCanvas,
  ) {
    palette.registerProvider(500, this);
    this._subprocessStore = subprocessStore;
    this._popupMenu       = popupMenu;
    this._eventBus        = eventBus;
    this._canvas          = canvas;
  }

  getPaletteEntries(): Record<string, object> {
    const store     = this._subprocessStore;
    const popupMenu = this._popupMenu;
    const eventBus  = this._eventBus;
    const canvas    = this._canvas;

    return {
      'reusable-subprocess-separator': {
        group:     'reusable',
        separator: true,
      },
      'reusable-subprocess-import': {
        group:     'reusable',
        className: 'csp-palette-import-sp',
        title:     'Import SubProcess XML file',
        action: {
          click() {
            eventBus.fire('subprocess.import-request');
          },
        },
      },
      'reusable-subprocess-place': {
        group:     'reusable',
        className: 'bpmn-icon-subprocess-collapsed csp-palette-reusable-sp',
        title:     'Place Reusable SubProcess',
        action: {
          click(event: MouseEvent) {
            const items = store.getAll();
            if (items.length === 0) {
              eventBus.fire('subprocess.import-request');
              return;
            }
            popupMenu.open(canvas.getRootElement(), 'reusable-subprocess', {
              x: event.clientX,
              y: event.clientY,
            });
          },
        },
      },
    };
  }
}
