// =============================================================================
// TabManagerService — bpmn-js DI service bridging the outer TabManager into
// the inner bpmn-js event system.
//
// Responsibilities
// ────────────────
//  1. Bridge tab lifecycle events → fire 'tabs.changed' on bpmn-js eventBus
//     so SubprocessStore can keep its "Open Diagrams" section in sync.
//
//  2. Dirty tracking — wire 'commandStack.changed' → TabManager.markDirty().
//
//  3. Diagram name ↔ tab title sync (bidirectional, guarded against loops):
//       • User edits root process name in canvas → tab title updated.
//       • User renames tab (TabBarUI inline edit) → diagram name updated.
//
//  4. Track switch state — TabSwitchCoordinator fires 'tabSwitch.started' /
//     'tabSwitch.ended' so dirty tracking is suppressed during XML reload.
//
// Bridge anatomy
// ──────────────
//   TabManager.events (TypedEventBus — outer)
//       └─► TabManagerService (DI — inner)
//               ├─► eventBus.fire('tabs.changed')  → SubprocessStore
//               ├─► tabManager.markDirty()         ← commandStack.changed
//               └─► modeling.updateProperties()    ↔ element.changed
//
// Setup
// ─────
//   new Modeler({
//     additionalModules: [TabManagerModule, ReusableSubprocessModule, ...],
//     tabManager: myTabManagerInstance,
//   });
// =============================================================================

import type { BpmnCanvas, BpmnEventBus } from '../../studio/bpmn-modeler-extender.js';
import type { BpmnModeling }             from '../../core/bpmn-types.js';
import type { TabManager }               from '../../tabs/tab-manager.js';
import type { SubprocessItem }           from '../reusable-subprocess/subprocess-store.js';

export class TabManagerService {
  static $inject = ['config.tabManager', 'eventBus', 'canvas', 'modeling'];

  private readonly _tabManager: TabManager;
  private readonly _eventBus:   BpmnEventBus;
  private readonly _canvas:     BpmnCanvas;
  private readonly _modeling:   BpmnModeling | null;

  /**
   * True while a tab switch is in progress (set via tabSwitch.started / .ended
   * events fired by TabSwitchCoordinator). Prevents spurious dirty marks and
   * name-sync triggers during XML reload.
   */
  private _isSwitching = false;

  /**
   * Guards against the tab-title ↔ diagram-name echo loop.
   * Set to true while we are programmatically updating one side so the
   * reactive listener on the other side skips its handler.
   */
  private _syncingName = false;

  constructor(
    tabManager: TabManager,
    eventBus:   BpmnEventBus,
    canvas:     BpmnCanvas,
    modeling:   BpmnModeling,
  ) {
    this._tabManager = tabManager;
    this._eventBus   = eventBus;
    this._canvas     = canvas;
    this._modeling   = modeling;

    this._wireBridge(tabManager, eventBus);
    this._wireDirtyTracking(tabManager, eventBus);
    this._wireNameSync(tabManager, eventBus);
    this._wireSwitchState(eventBus);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Returns all eligible tabs as SubprocessItems for SubprocessStore.
   * Excluded: the active tab (can't place a diagram into itself) and error tabs.
   */
  getTabItems(): SubprocessItem[] {
    const activeId = this._tabManager.getActiveId();
    return this._tabManager.getAll()
      .filter(t => t.id !== activeId && t.lifecycle !== 'error')
      .map(t => ({
        storeId:    `__tab__${t.id}`,
        name:       t.title,
        xml:        '',
        createdAt:  t.createdAt,
        resolveXml: () => this._tabManager.loadXml(t.id),
      }));
  }

  // ── Private wiring ──────────────────────────────────────────────────────────

  /**
   * Bridge: every tab mutation fires 'tabs.changed' on the bpmn-js eventBus
   * so SubprocessStore can reactively update its "Open Diagrams" section.
   */
  private _wireBridge(tabManager: TabManager, eventBus: BpmnEventBus): void {
    const sync = (): void =>
      eventBus.fire('tabs.changed', { tabs: this.getTabItems() });

    tabManager.events.on('tab.added',     sync);
    tabManager.events.on('tab.removed',   sync);
    tabManager.events.on('tab.activated', sync);
    tabManager.events.on('tab.lifecycle', sync);
    // tab.updated is handled in _wireNameSync (it also calls sync)
  }

  /**
   * Dirty tracking: any user edit (commandStack.changed) marks the active tab
   * dirty. Suppressed during tab switches and programmatic name syncing.
   */
  private _wireDirtyTracking(tabManager: TabManager, eventBus: BpmnEventBus): void {
    eventBus.on('commandStack.changed', () => {
      if (this._isSwitching || this._syncingName) return;
      const activeId = tabManager.getActiveId();
      if (activeId) tabManager.markDirty(activeId);
    });
  }

  /**
   * Bidirectional name sync between the active diagram's root process and
   * the corresponding tab title. Guard flag prevents echo loops.
   *
   *   Tab renamed (TabBarUI) → tab.updated → _syncDiagramName()
   *   Diagram root renamed   → element.changed → tabManager.patch({ title })
   */
  private _wireNameSync(tabManager: TabManager, eventBus: BpmnEventBus): void {
    // Tab title → diagram name (also fires tabs.changed for subprocess sync)
    tabManager.events.on('tab.updated', ({ tab }) => {
      eventBus.fire('tabs.changed', { tabs: this.getTabItems() });
      if (tab.id !== tabManager.getActiveId() || this._syncingName) return;
      this._syncDiagramName(tab.title);
    });

    // Diagram name → tab title
    eventBus.on('element.changed', (e: Record<string, unknown>) => {
      if (this._isSwitching || this._syncingName) return;
      try {
        const element = e['element'] as any;
        if (!element) return;
        if (element.id !== this._canvas.getRootElement().id) return;
        const newName = element.businessObject?.name as string | undefined;
        const activeId = tabManager.getActiveId();
        if (!activeId || !newName) return;
        const current = tabManager.get(activeId);
        if (current && current.title !== newName) {
          this._syncingName = true;
          tabManager.patch(activeId, { title: newName });
          this._syncingName = false;
        }
      } catch { /* ignore — e.g. missing businessObject in viewer mode */ }
    });
  }

  /**
   * Track whether a tab switch is in progress.
   * TabSwitchCoordinator fires these events on the bpmn-js eventBus so that
   * dirty tracking and name sync are suppressed during XML reload.
   */
  private _wireSwitchState(eventBus: BpmnEventBus): void {
    eventBus.on('tabSwitch.started', () => { this._isSwitching = true; });
    eventBus.on('tabSwitch.ended',   () => { this._isSwitching = false; });
  }

  /**
   * Push a name into the active diagram's root process element.
   * Guarded against echo loops via _syncingName.
   */
  private _syncDiagramName(name: string): void {
    if (!this._modeling || this._syncingName) return;
    try {
      const root = this._canvas.getRootElement() as any;
      // Skip if name already matches to avoid an unnecessary commandStack entry.
      if (root.businessObject?.name === name) return;
      this._syncingName = true;
      this._modeling.updateProperties(root, { name });
    } catch { /* viewer mode — no modeling service; silent fail */ }
    finally { this._syncingName = false; }
  }
}
