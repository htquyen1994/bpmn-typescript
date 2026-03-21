import type { BpmnCanvas } from '../../studio/bpmn-modeler-extender.js';
import type { BpmnPalette, BpmnPopupMenu } from '../../core/bpmn-types.js';

/**
 * Adds a "⋯" (three-dots) entry to the bpmn-js palette.
 * Clicking it opens a popup menu listing selectable BPMN task / activity types.
 */
export class TaskTypePaletteProvider {
  static $inject = ['palette', 'popupMenu', 'canvas'];

  private readonly _popupMenu: BpmnPopupMenu;
  private readonly _canvas: BpmnCanvas;

  constructor(palette: BpmnPalette, popupMenu: BpmnPopupMenu, canvas: BpmnCanvas) {
    palette.registerProvider(400, this);
    this._popupMenu = popupMenu;
    this._canvas    = canvas;
  }

  getPaletteEntries(): Record<string, object> {
    const popupMenu = this._popupMenu;
    const canvas    = this._canvas;

    return {
      'task-type-more': {
        group:     'activity',
        className: 'csp-palette-task-type-more',
        title:     'More task types…',
        action: {
          click(event: MouseEvent) {
            popupMenu.open(canvas.getRootElement(), 'bpmn-task-types', {
              x: event.clientX,
              y: event.clientY,
            });
          },
        },
      },
    };
  }
}
