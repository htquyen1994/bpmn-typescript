export { CSPBpm } from './facade/csp-bpmn-facade.js';

// ── Custom Properties Panel ───────────────────────────────────────────────────
export { CustomPropertiesPanel, PropertyRendererFactory, ValidationEngine } from './custom-properties/index.js';
export type {
  IPropertyRenderer,
  IValidationStrategy,
  PropertyType,
  SelectOption,
  OptionsSource,
  ValidationRule,
  ValidationErrors,
  TextPropertyConfig,
  CheckboxPropertyConfig,
  SelectionPropertyConfig,
  CustomPropertyConfig,
  PropertyTarget,
} from './custom-properties/index.js';

// ── Reusable base class / advanced exports ────────────────────────────────────
export { BaseComponent }        from './base/base-component.js';
export { BpmnModelerExtender }  from './studio/bpmn-modeler-extender.js';
export type {
  BpmnCanvas,
  BpmnViewbox,
  BpmnEventBus,
  BpmnCommandStack,
  BpmnElementRegistry,
} from './studio/bpmn-modeler-extender.js';

export { ReusableSubprocessModule } from './studio/reusable-subprocess/index.js';
export type { SubprocessItem }      from './studio/reusable-subprocess/index.js';

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

// ── Multi-diagram tab management ──────────────────────────────────────────────
export { TypedEventBus, TabStore, TabManager } from './multi/index.js';
export type {
  DiagramTabState,
  TabLifecycle,
  ViewboxSnapshot,
  AddTabConfig,
  TabManagerConfig,
  TabEventMap,
  TabEvent,
  BeforeActivateHook,
} from './multi/index.js';
