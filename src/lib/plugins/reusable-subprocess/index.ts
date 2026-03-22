import { SubprocessStore } from './subprocess-store.js';
import { SubprocessPaletteProvider } from './subprocess-palette-provider.js';
import { SubprocessPopupProvider } from './subprocess-popup-provider.js';

export { SubprocessStore, SubprocessPaletteProvider, SubprocessPopupProvider };
export { SubprocessCreator } from './subprocess-creator.js';
export type { SubprocessItem }   from './subprocess-store.js';
export type { SubprocessSource } from './subprocess-source.js';

/**
 * bpmn-js additional module that enables reusable SubProcesses:
 *  - `SubprocessStore`         – in-memory XML store.
 *  - `SubprocessPaletteProvider` – palette entries (place + import).
 *  - `SubprocessPopupProvider`   – popup menu listing stored items.
 *
 * Register this in the Modeler's `additionalModules` list.
 * The studio also wires the file-picker and `subprocess.create` event.
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
