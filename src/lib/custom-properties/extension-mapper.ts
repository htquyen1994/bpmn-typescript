import type { CustomPropertyConfig } from './types.js';

/**
 * Handles reading from and writing to `bpmn:ExtensionElements` →
 * `activiti:Properties` / `activiti:Property`.
 *
 * Separated from `BpmnPropertiesProvider` so that BPMN persistence logic lives
 * in its own class and can be tested or swapped independently.
 *
 * Note: the caller is responsible for wrapping `write()` with a `_writing`
 * guard flag to prevent the `commandStack.changed` listener from re-rendering
 * during the write.
 */
export class ExtensionMapper {
  constructor(
    private readonly _elementRegistry: any,
    private readonly _moddle: any,
    private readonly _modeling: any,
  ) {}

  // ── Read ──────────────────────────────────────────────────────────────────

  /**
   * Read all `activiti:Property` entries from the element's extensionElements.
   * Returns a flat map of `{ name → raw-string-value }`.
   */
  read(elementId: string): Record<string, string> {
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

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Overwrite the `activiti:Properties` block for an element, preserving any
   * other extension-element entries.  Calls `modeling.updateProperties()` so
   * the change is tracked by the command stack (undo / redo works).
   */
  write(elementId: string, values: Record<string, unknown>): void {
    const el = this._elementRegistry.get(elementId);
    if (!el) return;

    const moddle = this._moddle;
    const bo     = el.businessObject;

    // Clone extensionElements so bpmn-js detects the change.
    let extEl = bo.extensionElements;
    extEl = extEl
      ? moddle.create('bpmn:ExtensionElements', { values: [...(extEl.values ?? [])] })
      : moddle.create('bpmn:ExtensionElements', { values: [] });

    // Drop previous activiti:Properties block; rebuild it fully.
    extEl.values = extEl.values.filter((v: any) => v.$type !== 'activiti:Properties');

    const propEntries = Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([name, value]) =>
        moddle.create('activiti:Property', { name, value: String(value) }),
      );

    if (propEntries.length > 0) {
      extEl.values.push(moddle.create('activiti:Properties', { values: propEntries }));
    }

    this._modeling.updateProperties(el, { extensionElements: extEl });
  }

  // ── Deserialize ───────────────────────────────────────────────────────────

  /**
   * Convert a raw string from extensionElements to the typed value expected
   * by the property config.
   */
  deserialize(raw: string, cfg: CustomPropertyConfig): unknown {
    if (cfg.type === 'checkbox') return raw === 'true';
    return raw;
  }

  // ── Element access ────────────────────────────────────────────────────────

  getElement(elementId: string): any {
    return this._elementRegistry.get(elementId);
  }
}
