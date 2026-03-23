import { TabManagerService } from './tab-manager-service.js';

export { TabManagerService };

/**
 * bpmn-js additional module that registers TabManagerService as a DI service.
 *
 * Requires `tabManager` to be passed in the Modeler config:
 *
 * @example
 *   import { TabManagerModule } from 'csp-bpmn';
 *
 *   new Modeler({
 *     additionalModules: [TabManagerModule, ReusableSubprocessModule],
 *     tabManager: myTabManagerInstance,
 *   });
 *
 * When combined with ReusableSubprocessModule the "Open Diagrams" popup section
 * is populated and kept in sync automatically — no manual SubprocessSource
 * configuration needed.
 */
export const TabManagerModule: { [key: string]: unknown } = {
  __init__: ['tabManagerService'],
  tabManagerService: ['type', TabManagerService],
};
