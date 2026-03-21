import type { CustomPropertyConfig, ValidationErrors } from '../../custom-panel/types.js';
import { ValidationEngine }       from '../../custom-panel/validation.js';
import { PropertyRendererFactory } from '../../custom-panel/renderers/factory.js';
import { PANEL_STYLES }            from '../../custom-panel/panel-styles.js';

/**
 * bpmn-js module service that:
 *  - Renders a custom-properties UI panel inside the studio (iframe).
 *  - Reads existing `activiti:properties` from `businessObject.extensionElements`
 *    when an element is selected.
 *  - Writes changes back to `extensionElements` via `modeling.updateProperties()`
 *    so they are included in `saveXML()` output and tracked by the command stack
 *    (undo / redo works out of the box).
 *
 * The `activiti:Properties` / `activiti:Property` namespace is used as the
 * persisted format — activiti-bpmn-moddle must be loaded in the modeler config
 * (the studio always loads it regardless of provider).
 */
export class CustomPropertiesProvider {
  static $inject = ['elementRegistry', 'moddle', 'modeling', 'eventBus'];

  private readonly _elementRegistry: any;
  private readonly _moddle: any;
  private readonly _modeling: any;
  private readonly _eventBus: any;
  private readonly _engine = new ValidationEngine();

  /** Configs keyed by specific element ID. */
  private readonly _byElementId = new Map<string, CustomPropertyConfig[]>();
  /** Configs keyed by BPMN type string (e.g. `'bpmn:UserTask'`). */
  private readonly _byBpmnType  = new Map<string, CustomPropertyConfig[]>();

  /** In-memory cache of current values per element. Kept in sync with extensionElements. */
  private readonly _store = new Map<string, Record<string, unknown>>();

  private _container:        HTMLElement | null = null;
  private _currentElementId: string | null = null;
  private _errors:           ValidationErrors = {};

  /**
   * Suppresses the commandStack.changed re-render while *we* are the ones
   * issuing the modeling command (prevents focus loss on every keystroke).
   */
  private _writing = false;

  constructor(
    elementRegistry: any,
    moddle: any,
    modeling: any,
    eventBus: any,
  ) {
    this._elementRegistry = elementRegistry;
    this._moddle          = moddle;
    this._modeling        = modeling;
    this._eventBus        = eventBus;

    this._injectStyles();
    this._bindEvents();
  }

  // ── Container ──────────────────────────────────────────────────────────────

  /** Called by the studio after the modeler is created. */
  setContainer(container: HTMLElement): void {
    this._container = container;
    this._render();
  }

  // ── Registration (called from facade → studioEl) ──────────────────────────

  registerForType(bpmnType: string, configs: CustomPropertyConfig[]): void {
    const prev = this._byBpmnType.get(bpmnType) ?? [];
    this._byBpmnType.set(bpmnType, [...prev, ...configs]);
    if (this._currentElementId) this._render();
  }

  registerForElement(elementId: string, configs: CustomPropertyConfig[]): void {
    const prev = this._byElementId.get(elementId) ?? [];
    this._byElementId.set(elementId, [...prev, ...configs]);
    if (this._currentElementId === elementId) this._render();
  }

  // ── Values ─────────────────────────────────────────────────────────────────

  /** Returns the current stored values. Falls back to reading from extensionElements. */
  getValues(elementId: string): Record<string, unknown> {
    const cached = this._store.get(elementId);
    if (cached !== undefined) return { ...cached };
    return this._readFromExtensionElements(elementId);
  }

  /** Programmatically write values into extensionElements (and re-render if selected). */
  setValues(elementId: string, values: Record<string, unknown>): void {
    const prev    = this._store.get(elementId) ?? {};
    const updated = { ...prev, ...values };
    this._store.set(elementId, updated);
    this._writeToExtensionElements(elementId, updated);
    if (this._currentElementId === elementId) this._render();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  validate(): boolean {
    if (!this._currentElementId) return true;
    const element = this._elementRegistry.get(this._currentElementId);
    if (!element) return true;

    const configs = this._getConfigs(this._currentElementId, element.type);
    const values  = this._store.get(this._currentElementId) ?? {};
    this._errors  = this._engine.validateAll(configs, values);
    this._render();
    return Object.keys(this._errors).length === 0;
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  private _bindEvents(): void {
    this._eventBus.on('selection.changed', (e: any) => {
      const el = (e?.newSelection as any[])?.[0] ?? null;

      if (el) {
        this._currentElementId = el.id;
        // Merge: XML values take precedence over defaults; keep in-memory edits if any.
        const fromXml  = this._readFromExtensionElements(el.id);
        const inMem    = this._store.get(el.id) ?? {};
        const configs  = this._getConfigs(el.id, el.type);
        const merged: Record<string, unknown> = {};
        for (const cfg of configs) {
          merged[cfg.key] =
            fromXml[cfg.key]   !== undefined ? this._deserialize(fromXml[cfg.key], cfg)
            : inMem[cfg.key]   !== undefined ? inMem[cfg.key]
            : cfg.defaultValue;
        }
        this._store.set(el.id, merged);
      } else {
        this._currentElementId = null;
      }

      this._errors = {};
      this._render();
    });

    // Re-read after undo / redo (but NOT after our own writes).
    this._eventBus.on('commandStack.changed', () => {
      if (this._writing || !this._currentElementId) return;
      const element = this._elementRegistry.get(this._currentElementId);
      if (!element) return;

      const fromXml = this._readFromExtensionElements(this._currentElementId);
      const configs = this._getConfigs(this._currentElementId, element.type);
      const synced: Record<string, unknown> = {};
      for (const cfg of configs) {
        synced[cfg.key] =
          fromXml[cfg.key] !== undefined
            ? this._deserialize(fromXml[cfg.key], cfg)
            : cfg.defaultValue;
      }
      this._store.set(this._currentElementId, synced);
      this._errors = {};
      this._render();
    });
  }

  // ── extensionElements I/O ──────────────────────────────────────────────────

  private _readFromExtensionElements(elementId: string): Record<string, string> {
    const el = this._elementRegistry.get(elementId);
    if (!el) return {};

    const extEl = el.businessObject?.extensionElements;
    if (!extEl?.values) return {};

    const activitiProps = extEl.values.find(
      (v: any) => v.$type === 'activiti:Properties',
    );
    if (!activitiProps?.values) return {};

    const result: Record<string, string> = {};
    for (const prop of activitiProps.values) {
      if (prop.name != null) result[prop.name] = prop.value ?? '';
    }
    return result;
  }

  private _writeToExtensionElements(
    elementId: string,
    values: Record<string, unknown>,
  ): void {
    const element = this._elementRegistry.get(elementId);
    if (!element) return;

    const moddle = this._moddle;
    const bo     = element.businessObject;

    // Clone extensionElements so bpmn-js detects the change.
    let extEl = bo.extensionElements;
    extEl = extEl
      ? moddle.create('bpmn:ExtensionElements', { values: [...(extEl.values ?? [])] })
      : moddle.create('bpmn:ExtensionElements', { values: [] });

    // Drop previous activiti:Properties block; we rebuild it fully.
    extEl.values = extEl.values.filter((v: any) => v.$type !== 'activiti:Properties');

    const propEntries = Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([name, value]) =>
        moddle.create('activiti:Property', { name, value: String(value) }),
      );

    if (propEntries.length > 0) {
      extEl.values.push(moddle.create('activiti:Properties', { values: propEntries }));
    }

    this._writing = true;
    this._modeling.updateProperties(element, { extensionElements: extEl });
    this._writing = false;
  }

  private _deserialize(raw: string, cfg: CustomPropertyConfig): unknown {
    if (cfg.type === 'checkbox') return raw === 'true';
    return raw;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _getConfigs(elementId: string, bpmnType: string): CustomPropertyConfig[] {
    return [
      ...(this._byElementId.get(elementId) ?? []),
      ...(this._byBpmnType.get(bpmnType)   ?? []),
    ];
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private _render(): void {
    if (!this._container) return;
    this._container.innerHTML = '';

    if (!this._currentElementId) {
      this._container.appendChild(
        this._buildEmpty('Select an element to view its custom properties.'),
      );
      return;
    }

    const element = this._elementRegistry.get(this._currentElementId);
    if (!element) {
      this._container.appendChild(this._buildEmpty('Element not found.'));
      return;
    }

    this._container.appendChild(this._buildElementInfo(element));

    const configs = this._getConfigs(this._currentElementId, element.type);
    if (configs.length === 0) {
      this._container.appendChild(
        this._buildEmpty('No custom properties defined for this element type.'),
      );
      return;
    }

    const list = document.createElement('div');
    list.className = 'cpp-properties';
    for (const cfg of configs) {
      list.appendChild(this._buildPropertyRow(cfg));
    }
    this._container.appendChild(list);
  }

  private _buildEmpty(msg: string): HTMLElement {
    const el = document.createElement('div');
    el.className   = 'cpp-empty';
    el.textContent = msg;
    return el;
  }

  private _buildElementInfo(element: any): HTMLElement {
    const el = document.createElement('div');
    el.className   = 'cpp-element-info';
    const bo = element.businessObject;

    if (bo?.name) {
      const name = document.createElement('div');
      name.className   = 'cpp-element-name';
      name.textContent = bo.name;
      el.appendChild(name);
    }
    const type = document.createElement('div');
    type.className   = 'cpp-element-type';
    type.textContent = element.type;
    el.appendChild(type);

    const id = document.createElement('div');
    id.className   = 'cpp-element-id';
    id.textContent = `ID: ${element.id}`;
    el.appendChild(id);

    return el;
  }

  private _buildPropertyRow(cfg: CustomPropertyConfig): HTMLElement {
    const elementId = this._currentElementId!;

    const row = document.createElement('div');
    row.className = 'cpp-property';

    if (cfg.type !== 'checkbox') {
      const label = document.createElement('span');
      label.className   = 'cpp-label' + (cfg.validation?.required ? ' cpp-label-required' : '');
      label.textContent = cfg.label;
      row.appendChild(label);
    }

    if (cfg.description) {
      const desc = document.createElement('span');
      desc.className   = 'cpp-description';
      desc.textContent = cfg.description;
      row.appendChild(desc);
    }

    const key          = cfg.key;
    const currentValue = this._store.get(elementId)?.[key] ?? cfg.defaultValue;

    const onChange = (value: unknown) => {
      if (this._currentElementId !== elementId) return;
      const prev    = this._store.get(elementId) ?? {};
      const updated = { ...prev, [key]: value };
      this._store.set(elementId, updated);
      this._writeToExtensionElements(elementId, updated);
      if (this._errors[key]?.length) {
        delete this._errors[key];
        this._clearFieldErrors(row, key);
      }
      cfg.onChange?.(value, elementId);
    };

    const onBlur = () => {
      if (this._currentElementId !== elementId || !cfg.validation) return;
      const val    = this._store.get(elementId)?.[key] ?? cfg.defaultValue;
      const errors = this._engine.validate(val, cfg.validation, cfg);
      this._errors[key] = errors;
      this._showFieldErrors(row, key, errors);
    };

    const renderer = PropertyRendererFactory.get(cfg.type);
    const fieldEl  = renderer.render(cfg, currentValue, onChange, onBlur);
    fieldEl.dataset.fieldKey = key;

    if ((this._errors[key] ?? []).length > 0) {
      fieldEl.querySelector('input,select,textarea')?.classList.add('cpp-input--invalid');
    }
    row.appendChild(fieldEl);

    const errorBox = document.createElement('div');
    errorBox.className          = 'cpp-errors';
    errorBox.dataset.errorsFor  = key;
    this._showFieldErrors(row, key, this._errors[key] ?? [], errorBox);
    row.appendChild(errorBox);

    return row;
  }

  private _showFieldErrors(
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
      span.className   = 'cpp-error';
      span.textContent = msg;
      box.appendChild(span);
    }
    const input = row.querySelector('input,select,textarea');
    input?.classList.toggle('cpp-input--invalid', errors.length > 0);
  }

  private _clearFieldErrors(row: HTMLElement, key: string): void {
    this._showFieldErrors(row, key, []);
  }

  private _injectStyles(): void {
    const id = 'csp-custom-properties-panel';
    if (document.head.querySelector(`style[data-csp-id="${id}"]`)) return;
    const style = document.createElement('style');
    style.setAttribute('data-csp-id', id);
    style.textContent = PANEL_STYLES;
    document.head.appendChild(style);
  }
}
