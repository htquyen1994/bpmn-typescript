// =============================================================================
// SubprocessStore — bpmn-js DI service managing reusable SubProcess items.
//
// Item partitions
// ───────────────
//   _importedItems  Items added by the user from file (file picker).
//                   XML is persisted to the pluggable AbstractXmlBackend and
//                   loaded lazily via resolveXml — never held in the Map.
//
//   _tabItems       Items sourced from open diagram tabs.
//                   Populated and kept in sync by TabManagerService via the
//                   'tabs.changed' bpmn-js eventBus event.
//                   Empty when TabManagerModule is not registered.
//
// Storage backend
// ───────────────
// Inject a custom AbstractXmlBackend via config.subprocessBackend to change
// where file-imported XML is persisted (default: MemoryXmlBackend):
//
//   new Modeler({
//     additionalModules: [ReusableSubprocessModule],
//     subprocessBackend: new IndexedDBXmlBackend('csp-subprocess'),
//   });
// =============================================================================

import type { BpmnEventBus }      from '../../studio/bpmn-modeler-extender.js';
import type { TabManagerService } from '../tab-manager/tab-manager-service.js';
import { AbstractXmlBackend, MemoryXmlBackend } from '../../core/xml-backend.js';

export interface SubprocessItem {
  /** Unique key inside the store (not the BPMN element id). */
  storeId: string;
  /** Human-readable label shown in the popup menu. */
  name: string;
  /**
   * Raw BPMN 2.0 XML string.
   * Empty string when `resolveXml` is provided (lazy loading).
   */
  xml: string;
  createdAt: number;
  /**
   * Optional async XML resolver.
   * When present, `xml` is ignored — the actual XML is fetched on demand
   * (e.g. from the storage backend or from an open diagram tab).
   */
  resolveXml?: () => Promise<string>;
}

export class SubprocessStore {
  static $inject = ['eventBus', 'tabManagerService', 'config.subprocessBackend'];

  private readonly _importedItems = new Map<string, SubprocessItem>();
  private _tabItems:              SubprocessItem[] = [];

  private readonly _eventBus: BpmnEventBus;
  private readonly _backend:  AbstractXmlBackend;

  /** True when TabManagerService was injected at construction time. */
  readonly hasTabIntegration: boolean;

  constructor(
    eventBus:           BpmnEventBus,
    tabManagerService:  TabManagerService,
    backend?:           AbstractXmlBackend,
  ) {
    this._eventBus = eventBus;
    this._backend  = backend ?? new MemoryXmlBackend();
    this.hasTabIntegration = tabManagerService != null;

    // Initial sync so the popup is populated even before any tab event fires.
    if (tabManagerService) {
      this._tabItems = tabManagerService.getTabItems();
    }

    // Reactive update — TabManagerService fires 'tabs.changed' on every
    // relevant tab mutation; we update our partition and notify listeners.
    eventBus.on('tabs.changed', (e: Record<string, unknown>) => {
      this._tabItems = e['tabs'] as SubprocessItem[];
      this._eventBus.fire('subprocess.store.changed', { items: this.getAll() });
    });
  }

  // ── Imported items (file-sourced) ────────────────────────────────────────

  /**
   * Register a file-imported SubProcess item.
   *
   * Metadata is visible in the store immediately (synchronous); the XML is
   * persisted to the backend as a fire-and-forget operation so the caller
   * is never blocked.
   */
  add(item: SubprocessItem): void {
    const meta: SubprocessItem = {
      storeId:    item.storeId,
      name:       item.name,
      createdAt:  item.createdAt,
      xml:        '',   // not held in memory — resolved via backend
      resolveXml: item.resolveXml ?? (() => this._backend.loadXml(item.storeId)),
    };

    this._importedItems.set(item.storeId, meta);
    this._eventBus.fire('subprocess.store.changed', { items: this.getAll() });

    // Persist to backend asynchronously — UI is never blocked by this.
    if (item.xml) {
      void this._backend.saveXml(item.storeId, item.xml);
    }
  }

  remove(storeId: string): void {
    if (this._importedItems.delete(storeId)) {
      void this._backend.removeXml(storeId);
      this._eventBus.fire('subprocess.store.changed', { items: this.getAll() });
    }
  }

  get(storeId: string): SubprocessItem | undefined {
    return this._importedItems.get(storeId)
      ?? this._tabItems.find(t => t.storeId === storeId);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  /** Items imported from files. Shown in the "Imported SubProcesses" popup section. */
  getImportedItems(): SubprocessItem[] {
    return [...this._importedItems.values()];
  }

  /**
   * Items sourced from open diagram tabs.
   * Shown in the "Open Diagrams" popup section.
   * Returns [] when TabManagerModule is not registered.
   */
  getTabItems(): SubprocessItem[] {
    return [...this._tabItems];
  }

  /** All items (imported + tab-sourced). Backwards-compatible aggregate. */
  getAll(): SubprocessItem[] {
    return [...this._importedItems.values(), ...this._tabItems];
  }

  // ── Import helper ────────────────────────────────────────────────────────

  /**
   * Build a SubprocessItem from a raw BPMN XML string.
   * Extracts the process / subprocess name via a lightweight regex (no full parse).
   */
  static itemFromXml(xml: string): SubprocessItem {
    const nameMatch = xml.match(/(?:bpmn:process|bpmn:subProcess)[^>]+name="([^"]+)"/i);
    const idMatch   = xml.match(/(?:bpmn:process|bpmn:subProcess)[^>]+id="([^"]+)"/i);
    const name = nameMatch?.[1] ?? idMatch?.[1] ?? 'SubProcess';
    return {
      storeId:   'rsp_' + Date.now().toString(36),
      name,
      xml,
      createdAt: Date.now(),
    };
  }
}
