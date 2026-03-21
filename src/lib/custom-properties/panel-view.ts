import type { CustomPropertyConfig, ValidationErrors } from './types.js';
import { ValidationEngine } from './validation.js';
import { PropertyRendererFactory } from './renderers/factory.js';

// ── Callback interface ────────────────────────────────────────────────────────

/**
 * Callbacks that `PanelView` uses to read/write values and errors.
 * Implemented differently by `BpmnPropertiesProvider` (extensionElements) and
 * `CustomPropertiesPanel` (in-memory store only).
 */
export interface PanelViewCallbacks {
  /** Read the current value for a field from the backing store. */
  readValue(elementId: string, key: string, defaultValue?: unknown): unknown;
  /**
   * Persist a changed value.
   * For the BPMN provider this writes through to extensionElements.
   * For the standalone panel this is in-memory only.
   */
  writeValue(elementId: string, key: string, value: unknown): void;
  /** Returns the currently selected element ID, or null. */
  getCurrentElementId(): string | null;
  /** Returns the current validation error map (read-only access). */
  getErrors(): ValidationErrors;
  /** Overwrite the error list for one field key. */
  setFieldErrors(key: string, errors: string[]): void;
  /** Remove errors for one field key. */
  clearFieldErrors(key: string): void;
}

// ── PanelView ─────────────────────────────────────────────────────────────────

/**
 * Stateless DOM builder for the custom-properties panel.
 *
 * Both `BpmnPropertiesProvider` (inside the bpmn-js iframe) and
 * `CustomPropertiesPanel` (host-page standalone panel) delegate all DOM
 * construction here, so the rendering logic lives in exactly one place.
 */
export class PanelView {
  constructor(private readonly _engine: ValidationEngine) {}

  // ── Header / empty states ─────────────────────────────────────────────────

  buildHeader(): HTMLElement {
    const el = document.createElement('div');
    el.className   = 'cpp-panel-header';
    el.textContent = 'Custom Properties';
    return el;
  }

  buildEmpty(msg: string): HTMLElement {
    const el = document.createElement('div');
    el.className   = 'cpp-empty';
    el.textContent = msg;
    return el;
  }

  // ── Element info ──────────────────────────────────────────────────────────

  buildElementInfo(name: string | undefined, type: string, id: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cpp-element-info';

    if (name) {
      const nameEl = document.createElement('div');
      nameEl.className   = 'cpp-element-name';
      nameEl.textContent = name;
      el.appendChild(nameEl);
    }

    const typeEl = document.createElement('div');
    typeEl.className   = 'cpp-element-type';
    typeEl.textContent = type;
    el.appendChild(typeEl);

    const idEl = document.createElement('div');
    idEl.className   = 'cpp-element-id';
    idEl.textContent = `ID: ${id}`;
    el.appendChild(idEl);

    return el;
  }

  // ── Property row ──────────────────────────────────────────────────────────

  /**
   * Build one property row including label, description, renderer field,
   * and an error container.
   *
   * All value reads/writes and error management are delegated to `cbs`.
   */
  buildPropertyRow(
    cfg: CustomPropertyConfig,
    elementId: string,
    cbs: PanelViewCallbacks,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'cpp-property';

    // Checkbox renderer embeds its own label.
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
    const currentValue = cbs.readValue(elementId, key, cfg.defaultValue);

    const onChange = (value: unknown) => {
      // Stale-closure guard: ignore if element has changed.
      if (cbs.getCurrentElementId() !== elementId) return;
      cbs.writeValue(elementId, key, value);
      // Clear the field-level error immediately on edit.
      if (cbs.getErrors()[key]?.length) {
        cbs.clearFieldErrors(key);
        this._applyErrors(row, key, []);
      }
      cfg.onChange?.(value, elementId);
    };

    const onBlur = () => {
      if (cbs.getCurrentElementId() !== elementId || !cfg.validation) return;
      const val    = cbs.readValue(elementId, key, cfg.defaultValue);
      const errors = this._engine.validate(val, cfg.validation, cfg);
      cbs.setFieldErrors(key, errors);
      this._applyErrors(row, key, errors);
    };

    const renderer = PropertyRendererFactory.get(cfg.type);
    const fieldEl  = renderer.render(cfg, currentValue, onChange, onBlur);
    fieldEl.dataset.fieldKey = key;

    // Pre-apply any existing errors (e.g. after validate() is called).
    const existingErrors = cbs.getErrors()[key] ?? [];
    if (existingErrors.length > 0) {
      fieldEl.querySelector('input,select,textarea')?.classList.add('cpp-input--invalid');
    }
    row.appendChild(fieldEl);

    // Error container — updated in-place on blur to avoid full re-render.
    const errorBox = document.createElement('div');
    errorBox.className         = 'cpp-errors';
    errorBox.dataset.errorsFor = key;
    this._applyErrors(row, key, existingErrors, errorBox);
    row.appendChild(errorBox);

    return row;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _applyErrors(
    row: HTMLElement,
    key: string,
    errors: string[],
    box?: HTMLElement,
  ): void {
    const errorBox =
      box ?? (row.querySelector(`[data-errors-for="${key}"]`) as HTMLElement | null);
    if (!errorBox) return;

    errorBox.innerHTML = '';
    for (const msg of errors) {
      const span = document.createElement('span');
      span.className   = 'cpp-error';
      span.textContent = msg;
      errorBox.appendChild(span);
    }

    const input = row.querySelector('input,select,textarea');
    input?.classList.toggle('cpp-input--invalid', errors.length > 0);
  }
}
