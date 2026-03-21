// @ts-ignore – Vite ?inline suffix resolves at build time
import libCss from 'diagram-js-minimap/assets/diagram-js-minimap.css?inline';
// @ts-ignore
import overrideCss from './minimap.css?inline';
import MinimapLib from 'diagram-js-minimap';

/**
 * Combined CSS: upstream library styles + local position / style overrides.
 * Inject this into the studio shadow-DOM via `addStyles()`.
 */
export const MINIMAP_CSS: string = (libCss as string) + '\n' + (overrideCss as string);

/**
 * bpmn-js DI module that registers the `minimap` service.
 * Pass this into `additionalModules` when constructing the Modeler.
 */
export const MinimapModule: { [key: string]: unknown } = MinimapLib as { [key: string]: unknown };
