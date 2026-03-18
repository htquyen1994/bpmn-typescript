import type { SubprocessStore, SubprocessItem } from './subprocess-store.js';

/**
 * Registers a popup-menu provider under the key `'reusable-subprocess'`.
 *
 * Each stored SubProcess becomes a menu entry. Clicking fires
 * `subprocess.create` on the eventBus; the studio handles the actual
 * XML-merge + re-import logic.
 *
 * A header entry allows importing a new XML without leaving the popup.
 */
export class SubprocessPopupProvider {
  static $inject = ['popupMenu', 'subprocessStore', 'eventBus'];

  private readonly _subprocessStore: SubprocessStore;
  private readonly _eventBus: any;

  constructor(
    popupMenu: any,
    subprocessStore: SubprocessStore,
    eventBus: any,
  ) {
    popupMenu.registerProvider('reusable-subprocess', 1500, this);
    this._subprocessStore = subprocessStore;
    this._eventBus        = eventBus;
  }

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
    const items     = this._subprocessStore.getAll();
    const eventBus  = this._eventBus;

    if (items.length === 0) {
      return {
        'sp-empty': {
          label:     'No SubProcesses stored yet — import one first.',
          className: 'csp-popup-sp-empty',
          disabled:  true,
          action()   { /* no-op */ },
        },
      };
    }

    const entries: Record<string, object> = {};
    for (const item of items) {
      const captured: SubprocessItem = item;
      entries['sp-' + captured.storeId] = {
        label:     captured.name,
        className: 'bpmn-icon-subprocess-collapsed',
        title:     `Place "${captured.name}" as a collapsed SubProcess`,
        action() {
          eventBus.fire('subprocess.create', { item: captured });
        },
      };
    }

    return entries;
  }
}
