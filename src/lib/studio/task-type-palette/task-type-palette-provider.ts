/**
 * Adds a "⋯" (three-dots) entry to the bpmn-js palette.
 * Clicking it opens a popup menu listing selectable BPMN task / activity types.
 */
export class TaskTypePaletteProvider {
  static $inject = ['palette', 'popupMenu', 'canvas'];

  private readonly _popupMenu: any;
  private readonly _canvas: any;

  constructor(palette: any, popupMenu: any, canvas: any) {
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
