// =============================================================================
// SubprocessSource — extension point for the reusable-subprocess popup menu
//
// Implement this interface to add a new group of subprocess items to the
// popup. Pass instances via the Modeler config key `subprocessSources`:
//
// @example
//   new Modeler({
//     additionalModules: [ReusableSubprocessModule],
//     subprocessSources: [new MyApiSubprocessSource()],
//   })
//
// The built-in SubprocessStore (imported files) is always shown first as
// "Imported SubProcesses". Each SubprocessSource you register appears below
// as its own labelled section.
// =============================================================================

import type { SubprocessItem } from './subprocess-store.js';

export interface SubprocessSource {
  /**
   * Section heading rendered above this source's items in the popup.
   * Keep it short (2–3 words).
   */
  readonly label: string;

  /**
   * Return current items for this source.
   * Called every time the popup opens — keep it synchronous and fast.
   * For async sources, pre-fetch externally and cache the result.
   *
   * Items may set `resolveXml` for lazy XML loading (e.g. tab-sourced diagrams).
   */
  getItems(): SubprocessItem[];
}
