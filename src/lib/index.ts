// Side-effect: registers <csp-bpmn-studio> custom element.
import './studio/csp-bpmn-studio.js';

export { CSPBpm } from './facade/csp-bpmn-facade.js';

// Re-usable base class for building additional Web Components.
export { BaseComponent } from './base/base-component.js';

// Typed bpmn-js wrapper.
export { BpmnModelerExtender } from './studio/bpmn-modeler-extender.js';
export type {
  BpmnCanvas,
  BpmnViewbox,
  BpmnEventBus,
  BpmnCommandStack,
  BpmnElementRegistry,
} from './studio/bpmn-modeler-extender.js';

// Reusable SubProcess module.
export { ReusableSubprocessModule } from './studio/reusable-subprocess/index.js';
export type { SubprocessItem } from './studio/reusable-subprocess/index.js';

export type {
  BpmnElement,
  BpmStudioMode,
  BpmnProvider,
  BpmnEventType,
  BpmnEventCallback,
  CSPBpmConfig,
  ExportXmlResult,
  ExportSvgResult,
} from './types/index.js';
