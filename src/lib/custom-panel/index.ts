// Register built-in renderers (side-effect)
import { PropertyRendererFactory } from './renderers/factory.js';
import { TextRenderer }            from './renderers/text.js';
import { CheckboxRenderer }        from './renderers/checkbox.js';
import { SelectionRenderer }       from './renderers/selection.js';

PropertyRendererFactory.register('text',      new TextRenderer());
PropertyRendererFactory.register('checkbox',  new CheckboxRenderer());
PropertyRendererFactory.register('selection', new SelectionRenderer());

// ── Public exports ────────────────────────────────────────────────────────────

export { CustomPropertiesPanel } from './custom-properties-panel.js';
export { PropertyRendererFactory } from './renderers/factory.js';
export { ValidationEngine } from './validation.js';

export type { IPropertyRenderer }   from './renderers/factory.js';
export type { IValidationStrategy } from './validation.js';

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
