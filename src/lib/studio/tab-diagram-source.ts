// =============================================================================
// @deprecated
//
// TabDiagramSource is no longer used internally.
//
// Tab-to-subprocess integration is now handled automatically via the
// TabManagerModule DI service and EventBus bridge:
//
//   new Modeler({
//     additionalModules: [TabManagerModule, ReusableSubprocessModule, ...],
//     tabManager: myTabManagerInstance,
//   });
//
// TabManagerService fires 'tabs.changed' on the bpmn-js eventBus whenever
// tabs change. SubprocessStore listens and updates its 'Open Diagrams' section
// reactively — no manual SubprocessSource configuration is needed.
//
// This file is kept for backwards compatibility only. It will be removed in a
// future major version.
// =============================================================================

import type { TabManager }     from '../tabs/tab-manager.js';
import type { SubprocessSource } from '../plugins/reusable-subprocess/subprocess-source.js';
import type { SubprocessItem }   from '../plugins/reusable-subprocess/subprocess-store.js';

/**
 * @deprecated Use TabManagerModule instead.
 * Pass `tabManager` via Modeler config and register TabManagerModule in
 * additionalModules — the "Open Diagrams" popup section is populated and
 * kept in sync automatically without this class.
 */
export class TabDiagramSource implements SubprocessSource {
  readonly label = 'Open Diagrams';

  constructor(private readonly _tabManager: TabManager) {}

  getItems(): SubprocessItem[] {
    const activeId = this._tabManager.getActiveId();

    return this._tabManager
      .getAll()
      .filter(tab => tab.id !== activeId && tab.lifecycle !== 'error')
      .map(tab => {
        const tabId   = tab.id;
        const manager = this._tabManager;
        return {
          storeId:    `tab-${tabId}`,
          name:       tab.title,
          xml:        '',
          createdAt:  tab.createdAt,
          resolveXml: () => manager.loadXml(tabId),
        };
      });
  }
}
