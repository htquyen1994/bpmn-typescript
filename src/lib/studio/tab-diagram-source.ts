// =============================================================================
// TabDiagramSource — SubprocessSource bridge between TabManager and the
// reusable-subprocess popup menu.
//
// Each open diagram tab (except the currently active one) is exposed as a
// SubprocessItem. The XML is loaded lazily via `resolveXml` so no upfront
// I/O occurs just because the popup was opened.
//
// Usage (pass to Modeler config):
//   new Modeler({
//     additionalModules: [ReusableSubprocessModule],
//     subprocessSources: [new TabDiagramSource(tabManager)],
//   })
// =============================================================================

import type { TabManager }     from '../tabs/tab-manager.js';
import type { SubprocessSource } from '../plugins/reusable-subprocess/subprocess-source.js';
import type { SubprocessItem }   from '../plugins/reusable-subprocess/subprocess-store.js';

export class TabDiagramSource implements SubprocessSource {
  readonly label = 'Open Diagrams';

  constructor(private readonly _tabManager: TabManager) {}

  getItems(): SubprocessItem[] {
    const activeId = this._tabManager.getActiveId();

    return this._tabManager
      .getAll()
      // Exclude the diagram currently open in the modeler (can't place itself)
      // and tabs that failed to load (no usable XML).
      .filter(tab => tab.id !== activeId && tab.lifecycle !== 'error')
      .map(tab => {
        const tabId   = tab.id;
        const manager = this._tabManager;
        return {
          storeId:    `tab-${tabId}`,
          name:       tab.title,
          xml:        '',                              // populated lazily below
          createdAt:  tab.createdAt,
          resolveXml: () => manager.loadXml(tabId),   // async fetch from store backend
        };
      });
  }
}
