import type { BpmnElement } from '../types/index.js';
import type { CustomPropertyConfig, ValidationErrors } from './types.js';
import { ValidationEngine } from './validation.js';
import { PropertyRendererFactory } from './renderers/factory.js';
import { PANEL_STYLES } from './panel-styles.js';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Host-page panel that renders custom properties for the currently selected
 * BPMN element. Designed to live outside the bpmn-js iframe.
 *
 * Lifecycle:
 *   1. `new CustomPropertiesPanel(container)` — attach to a DOM element.
 *   2. `addPropertiesForElement / addPropertiesForType` — register configs.
 *   3. `onElementSelected(element)` — called by the facade on selection change.
 *   4. `getValues(elementId)` — retrieve stored values at any time.
 */
export class CustomPropertiesPanel {
  private readonly container: HTMLElement;
  private readonly engine = new ValidationEngine();

  /** Registrations keyed by BPMN element ID. */
  private readonly byElementId = new Map<string, CustomPropertyConfig[]>();
  /** Registrations keyed by BPMN type string (e.g. 'bpmn:UserTask'). */
  private readonly byBpmnType  = new Map<string, CustomPropertyConfig[]>();

  /** Persisted values: elementId → { propertyKey → value }. */
  private readonly store = new Map<string, Record<string, unknown>>();

  private currentElement: BpmnElement | null = null;
  private currentErrors: ValidationErrors = {};

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('cpp-panel');
    this.injectStyles();
    this.renderInitialState();
  }

  // ── Registration ─────────────────────────────────────────────────────────────

  addPropertiesForElement(elementId: string, configs: CustomPropertyConfig[]): void {
    const prev = this.byElementId.get(elementId) ?? [];
    this.byElementId.set(elementId, [...prev, ...configs]);
  }

  addPropertiesForType(bpmnType: string, configs: CustomPropertyConfig[]): void {
    const prev = this.byBpmnType.get(bpmnType) ?? [];
    this.byBpmnType.set(bpmnType, [...prev, ...configs]);
  }

  // ── Selection ─────────────────────────────────────────────────────────────────

  onElementSelected(element: BpmnElement | null): void {
    this.currentElement = element;
    this.currentErrors  = {};
    this.render();
  }

  // ── Value store ───────────────────────────────────────────────────────────────

  getValues(elementId: string): Record<string, unknown> {
    return { ...(this.store.get(elementId) ?? {}) };
  }

  setValues(elementId: string, values: Record<string, unknown>): void {
    const prev = this.store.get(elementId) ?? {};
    this.store.set(elementId, { ...prev, ...values });
    if (this.currentElement?.id === elementId) this.render();
  }

  /**
   * Run validation for all properties of the current element.
   * Re-renders the panel to surface any errors.
   * Returns true when there are no validation errors.
   */
  validate(): boolean {
    if (!this.currentElement) return true;
    const configs = this.getConfigsFor(this.currentElement);
    const values  = this.store.get(this.currentElement.id) ?? {};
    this.currentErrors = this.engine.validateAll(configs, values);
    this.render();
    return Object.keys(this.currentErrors).length === 0;
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private getConfigsFor(element: BpmnElement): CustomPropertyConfig[] {
    return [
      ...(this.byElementId.get(element.id)   ?? []),
      ...(this.byBpmnType.get(element.type)  ?? []),
    ];
  }

  private readValue(elementId: string, key: string, defaultValue?: unknown): unknown {
    return this.store.get(elementId)?.[key] ?? defaultValue;
  }

  private writeValue(elementId: string, key: string, value: unknown): void {
    const prev = this.store.get(elementId) ?? {};
    this.store.set(elementId, { ...prev, [key]: value });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = '';
    this.container.appendChild(this.buildHeader());

    if (!this.currentElement) {
      this.container.appendChild(this.buildEmpty('Select an element to view its custom properties.'));
      return;
    }

    this.container.appendChild(this.buildElementInfo(this.currentElement));

    const configs = this.getConfigsFor(this.currentElement);
    if (configs.length === 0) {
      this.container.appendChild(this.buildEmpty('No custom properties defined for this element.'));
      return;
    }

    const list = document.createElement('div');
    list.className = 'cpp-properties';
    for (const cfg of configs) {
      list.appendChild(this.buildPropertyRow(cfg));
    }
    this.container.appendChild(list);
  }

  private buildHeader(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cpp-panel-header';
    el.textContent = 'Custom Properties';
    return el;
  }

  private buildEmpty(msg: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cpp-empty';
    el.textContent = msg;
    return el;
  }

  private buildElementInfo(element: BpmnElement): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cpp-element-info';

    if (element.name) {
      const name = document.createElement('div');
      name.className = 'cpp-element-name';
      name.textContent = element.name;
      el.appendChild(name);
    }

    const type = document.createElement('div');
    type.className = 'cpp-element-type';
    type.textContent = element.type;
    el.appendChild(type);

    const id = document.createElement('div');
    id.className = 'cpp-element-id';
    id.textContent = `ID: ${element.id}`;
    el.appendChild(id);

    return el;
  }

  private buildPropertyRow(cfg: CustomPropertyConfig): HTMLElement {
    const elementId = this.currentElement!.id;

    const row = document.createElement('div');
    row.className = 'cpp-property';

    // Checkbox renderer includes its own label — skip the separate label
    if (cfg.type !== 'checkbox') {
      const label = document.createElement('span');
      label.className =
        'cpp-label' + (cfg.validation?.required ? ' cpp-label-required' : '');
      label.textContent = cfg.label;
      row.appendChild(label);
    }

    if (cfg.description) {
      const desc = document.createElement('span');
      desc.className = 'cpp-description';
      desc.textContent = cfg.description;
      row.appendChild(desc);
    }

    // --- Closures capture elementId + key so stale renders don't collide ---
    const key          = cfg.key;
    const currentValue = this.readValue(elementId, key, cfg.defaultValue);

    const onChange = (value: unknown) => {
      // Guard: selection may have changed since this render
      if (this.currentElement?.id !== elementId) return;
      this.writeValue(elementId, key, value);
      // Clear field-level error immediately on edit
      if (this.currentErrors[key]?.length) {
        delete this.currentErrors[key];
        this.clearFieldErrors(row, key);
      }
      cfg.onChange?.(value, elementId);
    };

    const onBlur = () => {
      if (this.currentElement?.id !== elementId || !cfg.validation) return;
      const val    = this.readValue(elementId, key, cfg.defaultValue);
      const errors = this.engine.validate(val, cfg.validation, cfg);
      this.currentErrors[key] = errors;
      this.showFieldErrors(row, key, errors);
    };

    const renderer = PropertyRendererFactory.get(cfg.type);
    const fieldEl  = renderer.render(cfg, currentValue, onChange, onBlur);
    fieldEl.dataset.fieldKey = key;

    // Apply invalid styling if errors already exist (e.g. after validate())
    if ((this.currentErrors[key] ?? []).length > 0) {
      fieldEl.querySelector('input,select,textarea')
        ?.classList.add('cpp-input--invalid');
    }

    row.appendChild(fieldEl);

    // Error container — updated in-place on blur
    const errorBox = document.createElement('div');
    errorBox.className = 'cpp-errors';
    errorBox.dataset.errorsFor = key;
    this.showFieldErrors(row, key, this.currentErrors[key] ?? [], errorBox);
    row.appendChild(errorBox);

    return row;
  }

  private showFieldErrors(
    row: HTMLElement,
    key: string,
    errors: string[],
    container?: HTMLElement,
  ): void {
    const box =
      container ??
      (row.querySelector(`[data-errors-for="${key}"]`) as HTMLElement | null);
    if (!box) return;

    box.innerHTML = '';
    for (const msg of errors) {
      const span = document.createElement('span');
      span.className = 'cpp-error';
      span.textContent = msg;
      box.appendChild(span);
    }

    const input = row.querySelector('input,select,textarea');
    if (errors.length) {
      input?.classList.add('cpp-input--invalid');
    } else {
      input?.classList.remove('cpp-input--invalid');
    }
  }

  private clearFieldErrors(row: HTMLElement, key: string): void {
    this.showFieldErrors(row, key, []);
  }

  private renderInitialState(): void {
    this.container.innerHTML = '';
    this.container.appendChild(this.buildHeader());
    this.container.appendChild(
      this.buildEmpty('Select an element to view its custom properties.'),
    );
  }

  private injectStyles(): void {
    const id = 'csp-custom-properties-panel';
    if (document.head.querySelector(`style[data-csp-id="${id}"]`)) return;
    const style = document.createElement('style');
    style.setAttribute('data-csp-id', id);
    style.textContent = PANEL_STYLES;
    document.head.appendChild(style);
  }
}
