import { SubprocessStore } from './subprocess-store.js';
import { SubprocessPaletteProvider } from './subprocess-palette-provider.js';
import { SubprocessPopupProvider } from './subprocess-popup-provider.js';

export { SubprocessStore, SubprocessPaletteProvider, SubprocessPopupProvider };
export { SubprocessCreator } from './subprocess-creator.js';
export type { SubprocessItem }   from './subprocess-store.js';
export type { SubprocessSource } from './subprocess-source.js';

/**
 * bpmn-js additional module that enables reusable SubProcesses:
 *  - `SubprocessStore`           – split-partition store (imported + tab items).
 *  - `SubprocessPaletteProvider` – palette entries (place + import).
 *  - `SubprocessPopupProvider`   – popup menu listing stored items.
 *
 * Register this in the Modeler's `additionalModules` list.
 *
 * For automatic "Open Diagrams" sync, also register TabManagerModule and pass
 * the TabManager instance via config:
 *
 *   new Modeler({
 *     additionalModules: [TabManagerModule, ReusableSubprocessModule, ...],
 *     tabManager: myTabManagerInstance,
 *   });
 *
 * For a custom XML storage backend, pass it via config.subprocessBackend:
 *
 *   new Modeler({
 *     additionalModules: [ReusableSubprocessModule],
 *     subprocessBackend: new IndexedDBXmlBackend('csp-subprocess'),
 *   });
 */
export const ReusableSubprocessModule: { [key: string]: unknown } = {
  __init__: [
    'subprocessStore',
    'subprocessPaletteProvider',
    'subprocessPopupProvider',
  ],
  subprocessStore:           ['type', SubprocessStore],
  subprocessPaletteProvider: ['type', SubprocessPaletteProvider],
  subprocessPopupProvider:   ['type', SubprocessPopupProvider],
};
