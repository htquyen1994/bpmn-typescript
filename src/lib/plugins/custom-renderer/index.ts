// @ts-ignore – Vite ?inline resolves at build time
import rendererStylesRaw from './renderer-styles.css?inline';

import { CustomBpmnRenderer } from './custom-bpmn-renderer.js';
import { PaletteIconPatch }   from './palette-icon-patch.js';

export { CustomBpmnRenderer } from './custom-bpmn-renderer.js';
export { PaletteIconPatch }   from './palette-icon-patch.js';

export const RENDERER_CSS = rendererStylesRaw as string;

/**
 * bpmn-js DI module.
 * - CustomBpmnRenderer  : shapes at priority 1500 (activities, events, gateways).
 * - PaletteIconPatch    : replaces bpmn-font palette icons with custom SVGs.
 *
 * Add to `additionalModules` in both Modeler and NavigatedViewer.
 */
export const CustomRendererModule: Record<string, unknown> = {
  __init__: ['customBpmnRenderer', 'paletteIconPatch'],
  customBpmnRenderer: ['type', CustomBpmnRenderer],
  paletteIconPatch:   ['type', PaletteIconPatch],
};
