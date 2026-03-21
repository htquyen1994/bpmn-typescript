// @ts-ignore – Vite ?inline suffix resolves at build time
import diagramCss from 'bpmn-js/dist/assets/diagram-js.css?inline';
// @ts-ignore
import bpmnCss from 'bpmn-js/dist/assets/bpmn-js.css?inline';
// @ts-ignore
import bpmnFontCss from 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css?inline';
// @ts-ignore
import propertiesPanelCss from '@bpmn-io/properties-panel/dist/assets/properties-panel.css?inline';
// @ts-ignore
import studioLayoutCss from './studio-layout.css?inline';

/** bpmn-js core CSS (diagram-js + bpmn-js + embedded font). */
export const BPMN_CORE_CSS: string = [diagramCss, bpmnCss, bpmnFontCss].join('\n');

/** @bpmn-io/properties-panel stylesheet. */
export const BPMN_PROPERTIES_CSS: string = propertiesPanelCss as string;

/** Layout CSS for the studio host element and inner panels. */
export const STUDIO_LAYOUT_CSS: string = studioLayoutCss as string;
