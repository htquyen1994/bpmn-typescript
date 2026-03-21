import type { BpmnElement } from '../types.js';
import type { CustomPropertyConfig, ValidationErrors } from './types.js';
import { ValidationEngine } from './validation.js';
import { PanelView } from './panel-view.js';
import type { PanelViewCallbacks } from './panel-view.js';
import { PANEL_STYLES, THEME_CSS } from './styles.js';

// Ensure built-in renderers are registered.
import './renderers/index.js';

/**
 * Host-page panel that renders custom properties for the currently selected
 * BPMN element.  Lives outside the bpmn-js iframe; values are stored in-memory
 * only (no extensionElements write-through).
 *
 * Lifecycle:
 *   1. `new CustomPropertiesPanel(container)` — attach to a DOM element.
 *   2. `addPropertiesForElement / addPropertiesForType` — register configs.
 *   3. `onElementSelected(element)` — called by the facade on selection change.
 *   4. `getValues(elementId)` — retrieve stored values at any time.
 */
export class CustomPropertiesPanel {
  private readonly _engine = new ValidationEngine();
  private readonly _view   = new PanelView(this._engine);

  /** Registrations keyed by BPMN element ID. */
  private readonly _byElementId = new Map<string, CustomPropertyConfig[]>();
  /** Registrations keyed by BPMN type string (e.g. `'bpmn:UserTask'`). */
  private readonly _byBpmnType  = new Map<string, CustomPropertyConfig[]>();

  /** Persisted values: elementId → { propertyKey → value }. */
  private readonly _store = new Map<string, Record<string, unknown>>();

  private _currentElement: BpmnElement | null = null;
  private _currentErrors:  ValidationErrors = {};

  constructor(private readonly _container: HTMLElement) {
    this._container.classList.add('cpp-panel');
    this._injectStyles();
    this._render();
  }

  // ── Registration ───────────────────────────────────────────────────────────

  addPropertiesForElement(elementId: string, configs: CustomPropertyConfig[]): void {
    const prev = this._byElementId.get(elementId) ?? [];
    this._byElementId.set(elementId, [...prev, ...configs]);
  }

  addPropertiesForType(bpmnType: string, configs: CustomPropertyConfig[]): void {
    const prev = this._byBpmnType.get(bpmnType) ?? [];
    this._byBpmnType.set(bpmnType, [...prev, ...configs]);
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  onElementSelected(element: BpmnElement | null): void {
    this._currentElement = element;
    this._currentErrors  = {};
    this._render();
  }

  // ── Value store ────────────────────────────────────────────────────────────

  getValues(elementId: string): Record<string, unknown> {
    return { ...(this._store.get(elementId) ?? {}) };
  }

  setValues(elementId: string, values: Record<string, unknown>): void {
    const prev = this._store.get(elementId) ?? {};
    this._store.set(elementId, { ...prev, ...values });
    if (this._currentElement?.id === elementId) this._render();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Run validation for all properties of the current element.
   * Re-renders the panel to surface any errors.
   * Returns true when there are no validation errors.
   */
  validate(): boolean {
    if (!this._currentElement) return true;
    const configs = this._getConfigsFor(this._currentElement);
    const values  = this._store.get(this._currentElement.id) ?? {};
    this._currentErrors = this._engine.validateAll(configs, values);
    this._render();
    return Object.keys(this._currentErrors).length === 0;
  }

  // ── Private – rendering ────────────────────────────────────────────────────

  private _render(): void {
    this._container.innerHTML = '';
    this._container.appendChild(this._view.buildHeader());

    if (!this._currentElement) {
      this._container.appendChild(
        this._view.buildEmpty('Select an element to view its custom properties.'),
      );
      return;
    }

    this._container.appendChild(
      this._view.buildElementInfo(
        this._currentElement.name,
        this._currentElement.type,
        this._currentElement.id,
      ),
    );

    const configs = this._getConfigsFor(this._currentElement);
    if (configs.length === 0) {
      this._container.appendChild(
        this._view.buildEmpty('No custom properties defined for this element.'),
      );
      return;
    }

    const list = document.createElement('div');
    list.className = 'cpp-properties';
    for (const cfg of configs) {
      list.appendChild(
        this._view.buildPropertyRow(cfg, this._currentElement.id, this._makeCallbacks()),
      );
    }
    this._container.appendChild(list);
  }

  private _makeCallbacks(): PanelViewCallbacks {
    return {
      readValue: (elementId, key, defaultValue) =>
        this._store.get(elementId)?.[key] ?? defaultValue,

      writeValue: (elementId, key, value) => {
        const prev = this._store.get(elementId) ?? {};
        this._store.set(elementId, { ...prev, [key]: value });
      },

      getCurrentElementId: () => this._currentElement?.id ?? null,
      getErrors:           () => this._currentErrors,
      setFieldErrors:      (key, errors) => { this._currentErrors[key] = errors; },
      clearFieldErrors:    (key) => { delete this._currentErrors[key]; },
    };
  }

  // ── Private – helpers ──────────────────────────────────────────────────────

  private _getConfigsFor(element: BpmnElement): CustomPropertyConfig[] {
    return [
      ...(this._byElementId.get(element.id)  ?? []),
      ...(this._byBpmnType.get(element.type) ?? []),
    ];
  }

  private _injectStyles(): void {
    this._injectOnce('csp-theme',                  THEME_CSS);
    this._injectOnce('csp-custom-properties-panel', PANEL_STYLES);
  }

  private _injectOnce(id: string, css: string): void {
    if (document.head.querySelector(`style[data-csp-id="${id}"]`)) return;
    const style = document.createElement('style');
    style.setAttribute('data-csp-id', id);
    style.textContent = css;
    document.head.appendChild(style);
  }
}
