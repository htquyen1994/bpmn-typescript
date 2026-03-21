// ─── Custom Properties Panel — Type definitions ───────────────────────────────

/** Supported property input types. Extend by registering a new renderer. */
export type PropertyType = 'text' | 'checkbox' | 'selection';

/** A single option in a selection property. */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Options source for a selection property.
 * - Static array: resolved immediately.
 * - Sync function: called once when the field renders.
 * - Async function: called once; shows a loading state until resolved (e.g. API call).
 */
export type OptionsSource =
  | SelectOption[]
  | (() => SelectOption[])
  | (() => Promise<SelectOption[]>);

/** Validation rules that can be declared per property. */
export interface ValidationRule {
  /** Field must have a non-empty value. */
  required?: boolean;
  /** String value must match this regex. */
  pattern?: RegExp | string;
  /** Numeric minimum (parses string values as float). */
  min?: number;
  /** Numeric maximum. */
  max?: number;
  /** Minimum string length. */
  minLength?: number;
  /** Maximum string length. */
  maxLength?: number;
  /** Arbitrary custom rule — return an error message or null. */
  custom?: (value: unknown) => string | null;
}

/** Error map: property key → list of error messages. */
export type ValidationErrors = Record<string, string[]>;

// ── Property config discriminated union ───────────────────────────────────────

interface BasePropertyConfig {
  /** Unique identifier within the element's custom data. */
  key: string;
  /** Human-readable label shown above the input. */
  label: string;
  /** Optional helper text shown below the label. */
  description?: string;
  /** Value used when no stored value exists for the element. */
  defaultValue?: unknown;
  /** Validation rules applied to this field. */
  validation?: ValidationRule;
  /** Called after every value change. Not called for validation failures. */
  onChange?: (value: unknown, elementId: string) => void;
}

export interface TextPropertyConfig extends BasePropertyConfig {
  type: 'text';
  placeholder?: string;
  /** Render as <textarea> instead of <input type="text">. */
  multiline?: boolean;
}

export interface CheckboxPropertyConfig extends BasePropertyConfig {
  type: 'checkbox';
}

export interface SelectionPropertyConfig extends BasePropertyConfig {
  type: 'selection';
  options: OptionsSource;
  placeholder?: string;
}

/** Union of all built-in property configs. */
export type CustomPropertyConfig =
  | TextPropertyConfig
  | CheckboxPropertyConfig
  | SelectionPropertyConfig;

// ── Registration target ───────────────────────────────────────────────────────

/**
 * Describes which BPMN elements receive the custom properties.
 * - `{ elementId }` — a single element by its BPMN ID.
 * - `{ bpmnType }` — all elements whose `type` matches (e.g. `'bpmn:UserTask'`).
 */
export type PropertyTarget =
  | { elementId: string }
  | { bpmnType: string };
