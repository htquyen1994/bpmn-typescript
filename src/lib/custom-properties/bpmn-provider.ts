import type { CustomPropertyConfig, ValidationErrors } from './types.js';
import { ValidationEngine } from './validation.js';
import { ExtensionMapper } from './extension-mapper.js';
import { PanelView } from './panel-view.js';
import type { PanelViewCallbacks } from './panel-view.js';
import { PANEL_STYLES } from './styles.js';

// Ensure built-in renderers are registered.
import './renderers/index.js';

/**
 * bpmn-js DI service that renders a custom-properties panel inside the studio
 * iframe and persists values to `bpmn:extensionElements` → `activiti:Properties`.
 *
 * Responsibilities:
 *   - Owns the in-memory value store and current-element pointer.
 *   - Listens to `selection.changed` and `commandStack.changed` events.
 *   - Delegates rendering to `PanelView`.
 *   - Delegates extensionElements I/O to `ExtensionMapper`.
 */
export class BpmnPropertiesProvider {
  static $inject = ['elementRegistry', 'moddle', 'modeling', 'eventBus'];

  private readonly _engine  = new ValidationEngine();
  private readonly _view    = new PanelView(this._engine);
  private readonly _mapper: ExtensionMapper;

  /** Configs keyed by specific element ID. */
  private readonly _byElementId = new Map<string, CustomPropertyConfig[]>();
  /** Configs keyed by BPMN type string (e.g. `'bpmn:UserTask'`). */
  private readonly _byBpmnType  = new Map<string, CustomPropertyConfig[]>();

  /** In-memory cache: elementId → { propertyKey → value }. Kept in sync with extensionElements. */
  private readonly _store = new Map<string, Record<string, unknown>>();

  private _container:        HTMLElement | null = null;
  private _currentElementId: string | null = null;
  private _errors:           ValidationErrors = {};

  /**
   * Suppresses the `commandStack.changed` re-render while we are the ones
   * issuing the modeling command (prevents focus loss on every keystroke).
   */
  private _writing = false;

  constructor(
    elementRegistry: any,
    moddle: any,
    private readonly _modeling: any,
    private readonly _eventBus: any,
  ) {
    this._mapper = new ExtensionMapper(elementRegistry, moddle, _modeling);
    this._injectStyles();
    this._bindEvents();
  }

  // ── Container ──────────────────────────────────────────────────────────────

  /** Called by the studio after the modeler is created. */
  setContainer(container: HTMLElement): void {
    this._container = container;
    this._render();
  }

  // ── Registration ───────────────────────────────────────────────────────────

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

  // ── Value store ────────────────────────────────────────────────────────────

  /** Returns current stored values. Falls back to reading from extensionElements. */
  getValues(elementId: string): Record<string, unknown> {
    const cached = this._store.get(elementId);
    if (cached !== undefined) return { ...cached };
    return this._mapper.read(elementId);
  }

  /** Programmatically write values into extensionElements (and re-render if selected). */
  setValues(elementId: string, values: Record<string, unknown>): void {
    const prev    = this._store.get(elementId) ?? {};
    const updated = { ...prev, ...values };
    this._store.set(elementId, updated);
    this._writeThrough(elementId, updated);
    if (this._currentElementId === elementId) this._render();
  }

  /**
   * Clear all cached values and reset the current-element pointer.
   * Called after `importXML` on a tab switch so stale in-memory data is discarded.
   */
  clearStore(): void {
    this._store.clear();
    this._currentElementId = null;
    this._errors = {};
    this._render();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  validate(): boolean {
    if (!this._currentElementId) return true;
    const element = this._mapper.getElement(this._currentElementId);
    if (!element) return true;

    const configs = this._getConfigs(this._currentElementId, element.type);
    const values  = this._store.get(this._currentElementId) ?? {};
    this._errors  = this._engine.validateAll(configs, values);
    this._render();
    return Object.keys(this._errors).length === 0;
  }

  // ── Private – events ───────────────────────────────────────────────────────

  private _bindEvents(): void {
    this._eventBus.on('selection.changed', (e: any) => {
      const el = (e?.newSelection as any[])?.[0] ?? null;

      if (el) {
        this._currentElementId = el.id;
        // Merge: XML values take precedence over defaults; keep in-memory edits if any.
        const fromXml = this._mapper.read(el.id);
        const inMem   = this._store.get(el.id) ?? {};
        const configs = this._getConfigs(el.id, el.type);
        const merged: Record<string, unknown> = {};
        for (const cfg of configs) {
          merged[cfg.key] =
            fromXml[cfg.key] !== undefined ? this._mapper.deserialize(fromXml[cfg.key], cfg)
            : inMem[cfg.key] !== undefined ? inMem[cfg.key]
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
      const element = this._mapper.getElement(this._currentElementId);
      if (!element) return;

      const fromXml = this._mapper.read(this._currentElementId);
      const configs = this._getConfigs(this._currentElementId, element.type);
      const synced: Record<string, unknown> = {};
      for (const cfg of configs) {
        synced[cfg.key] =
          fromXml[cfg.key] !== undefined
            ? this._mapper.deserialize(fromXml[cfg.key], cfg)
            : cfg.defaultValue;
      }
      this._store.set(this._currentElementId, synced);
      this._errors = {};
      this._render();
    });
  }

  // ── Private – rendering ────────────────────────────────────────────────────

  private _render(): void {
    if (!this._container) return;
    this._container.innerHTML = '';

    if (!this._currentElementId) {
      this._container.appendChild(
        this._view.buildEmpty('Select an element to view its custom properties.'),
      );
      return;
    }

    const element = this._mapper.getElement(this._currentElementId);
    if (!element) {
      this._container.appendChild(this._view.buildEmpty('Element not found.'));
      return;
    }

    this._container.appendChild(
      this._view.buildElementInfo(element.businessObject?.name, element.type, element.id),
    );

    const configs = this._getConfigs(this._currentElementId, element.type);
    if (configs.length === 0) {
      this._container.appendChild(
        this._view.buildEmpty('No custom properties defined for this element type.'),
      );
      return;
    }

    const list = document.createElement('div');
    list.className = 'cpp-properties';
    for (const cfg of configs) {
      list.appendChild(this._view.buildPropertyRow(cfg, this._currentElementId, this._makeCallbacks()));
    }
    this._container.appendChild(list);
  }

  private _makeCallbacks(): PanelViewCallbacks {
    return {
      readValue: (elementId, key, defaultValue) =>
        this._store.get(elementId)?.[key] ?? defaultValue,

      writeValue: (elementId, key, value) => {
        const prev    = this._store.get(elementId) ?? {};
        const updated = { ...prev, [key]: value };
        this._store.set(elementId, updated);
        this._writeThrough(elementId, updated);
      },

      getCurrentElementId: () => this._currentElementId,
      getErrors:           () => this._errors,
      setFieldErrors:      (key, errors) => { this._errors[key] = errors; },
      clearFieldErrors:    (key) => { delete this._errors[key]; },
    };
  }

  // ── Private – extensionElements write-through ──────────────────────────────

  private _writeThrough(elementId: string, values: Record<string, unknown>): void {
    this._writing = true;
    try {
      this._mapper.write(elementId, values);
    } finally {
      this._writing = false;
    }
  }

  // ── Private – helpers ──────────────────────────────────────────────────────

  private _getConfigs(elementId: string, bpmnType: string): CustomPropertyConfig[] {
    return [
      ...(this._byElementId.get(elementId) ?? []),
      ...(this._byBpmnType.get(bpmnType)   ?? []),
    ];
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

// ── bpmn-js DI module ─────────────────────────────────────────────────────────

export const CustomPropertiesModule: { [key: string]: unknown } = {
  __init__: ['customPropertiesProvider'],
  customPropertiesProvider: ['type', BpmnPropertiesProvider],
};
