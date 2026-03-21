// ── Types ─────────────────────────────────────────────────────────────────────
export type {
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
} from './types.js';

// ── Styles ────────────────────────────────────────────────────────────────────
export { PANEL_STYLES } from './styles.js';

// ── Validation ────────────────────────────────────────────────────────────────
export { ValidationEngine } from './validation.js';
export type { IValidationStrategy } from './validation.js';

// ── Renderers ─────────────────────────────────────────────────────────────────
export { PropertyRendererFactory } from './renderers/index.js';
export type { IPropertyRenderer } from './renderers/index.js';

// ── Shared view ───────────────────────────────────────────────────────────────
export { PanelView } from './panel-view.js';
export type { PanelViewCallbacks } from './panel-view.js';

// ── BPMN extension mapper ─────────────────────────────────────────────────────
export { ExtensionMapper } from './extension-mapper.js';

// ── bpmn-js provider + DI module ─────────────────────────────────────────────
export { BpmnPropertiesProvider, CustomPropertiesModule } from './bpmn-provider.js';

// ── Standalone host-page panel ────────────────────────────────────────────────
export { CustomPropertiesPanel } from './standalone-panel.js';
