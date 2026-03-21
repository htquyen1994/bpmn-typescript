import type { BpmnEventBus } from '../../studio/bpmn-modeler-extender.js';

export interface SubprocessItem {
  /** Unique key inside the store (not the BPMN id). */
  storeId: string;
  /** Human-readable label shown in the popup menu. */
  name: string;
  /** Raw BPMN 2.0 XML string. */
  xml: string;
  createdAt: number;
}

/**
 * In-memory store for reusable SubProcess XML snippets.
 *
 * Registered as a bpmn-js service so palette / popup providers can inject it.
 * Also accessible from outside the IoC container via BpmnModelerExtender.
 */

export class SubprocessStore {
  static $inject = ['eventBus'];

  private readonly _items = new Map<string, SubprocessItem>();
  private readonly _eventBus: BpmnEventBus;

  constructor(eventBus: BpmnEventBus) {
    this._eventBus = eventBus;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  add(item: SubprocessItem): void {
    this._items.set(item.storeId, item);
    this._eventBus.fire('subprocess.store.changed', { items: this.getAll() });
  }

  remove(storeId: string): void {
    this._items.delete(storeId);
    this._eventBus.fire('subprocess.store.changed', { items: this.getAll() });
  }

  get(storeId: string): SubprocessItem | undefined {
    return this._items.get(storeId);
  }

  getAll(): SubprocessItem[] {
    return [...this._items.values()];
  }

  // ── Import helper ────────────────────────────────────────────────────────────

  /**
   * Build a `SubprocessItem` from a raw BPMN XML string.
   * Extracts the process/subprocess name via a lightweight regex (no full parse).
   */
  static itemFromXml(xml: string): SubprocessItem {
    const nameMatch = xml.match(/(?:bpmn:process|bpmn:subProcess)[^>]+name="([^"]+)"/i);
    const idMatch   = xml.match(/(?:bpmn:process|bpmn:subProcess)[^>]+id="([^"]+)"/i);
    const name = nameMatch?.[1] ?? idMatch?.[1] ?? 'SubProcess';
    return {
      storeId: 'rsp_' + Date.now().toString(36),
      name,
      xml,
      createdAt: Date.now(),
    };
  }
}
