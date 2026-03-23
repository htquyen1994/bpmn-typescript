// =============================================================================
// TabSwitchCoordinator — orchestrates all async tab switching operations.
//
// Why a separate class?
// ─────────────────────
// Tab switching requires two capabilities that cannot both live in the same
// place naturally:
//
//   • TabManager (outer)        — owns tab metadata, storage, event bus
//   • bpmn-js Modeler (outer)   — owns importXML / saveXML / canvas
//
// These operations are NOT available as bpmn-js DI services, so they cannot
// be handled inside TabManagerService. This coordinator sits outside the DI
// container and holds references to both.
//
// Lifecycle
// ─────────
//   1. Construct once with TabManager + LoadingOverlay.
//   2. Call bind(modeler) each time a new Modeler instance is created.
//      This also triggers _initTabsAfterCreate() and exposes tabsReady.
//   3. Call bind(null) before destroying the modeler.
//
// Switch state signalling
// ───────────────────────
// The coordinator fires 'tabSwitch.started' / 'tabSwitch.ended' on the
// bpmn-js eventBus so TabManagerService can suppress dirty tracking and
// name-sync during XML reload.
// =============================================================================

import type { BpmnModelerExtender } from './bpmn-modeler-extender.js';
import type { TabManager }          from '../tabs/tab-manager.js';
import type { TabMeta, AddTabConfig as TabAddConfig } from '../tabs/types.js';
import type { LoadingOverlay }      from '../loading/loading-overlay.js';

/** Internal bpmn-js events used to coordinate with TabManagerService. */
const EV_SWITCH_STARTED = 'tabSwitch.started';
const EV_SWITCH_ENDED   = 'tabSwitch.ended';

export class TabSwitchCoordinator {
  private _modeler:   BpmnModelerExtender | null = null;
  private _switching  = false;

  /**
   * Resolves when the initial tab set is loaded after bind(modeler).
   * Studio awaits this before accepting public API calls (e.g. loadXML).
   */
  tabsReady: Promise<void> = Promise.resolve();

  constructor(
    private readonly _tabManager:     TabManager,
    private readonly _loadingOverlay: LoadingOverlay,
    private readonly _emptyXml:       string,
  ) {}

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Bind a newly created modeler instance.
   * Pass `null` before destroying the modeler to prevent stale references.
   */
  bind(modeler: BpmnModelerExtender | null): void {
    this._modeler = modeler;
    this.tabsReady = modeler ? this._initTabsAfterCreate() : Promise.resolve();
  }

  // ── Public switching API ────────────────────────────────────────────────────

  async switchToTab(nextId: string): Promise<boolean> {
    if (this._switching || !this._modeler) return false;

    this._switching = true;
    this._modeler.eventBus.fire(EV_SWITCH_STARTED);
    this._loadingOverlay.show();
    try {
      // Snapshot the current tab before leaving
      const currentId = this._tabManager.getActiveId();
      if (currentId) {
        try {
          const { xml } = await this._modeler.saveXML({ format: true });
          await this._tabManager.snapshot(currentId, xml ?? '', this._modeler.getViewbox());
        } catch { /* ignore — diagram may be empty or viewer mode */ }
      }

      const ok = await this._tabManager.activate(nextId);
      if (!ok) return false;

      const nextTab = this._tabManager.getActive();
      if (nextTab) await this._loadTabXML(nextTab);

      return true;
    } finally {
      this._switching = false;
      this._modeler?.eventBus.fire(EV_SWITCH_ENDED);
      this._loadingOverlay.hide();
    }
  }

  async addAndActivateTab(config?: TabAddConfig): Promise<TabMeta> {
    const tab = this._tabManager.add(config);
    await this.switchToTab(tab.id);
    return tab;
  }

  async onTabClose(id: string): Promise<void> {
    if (!this._tabManager.has(id)) return;

    const wasActive = this._tabManager.getActiveId() === id;
    const adjacent  = this._tabManager.getAdjacentTo(id);

    // Snapshot before removing so the user can reopen the tab later (or undo)
    if (wasActive && this._modeler) {
      try {
        const { xml } = await this._modeler.saveXML({ format: true });
        await this._tabManager.snapshot(id, xml ?? '', this._modeler.getViewbox());
      } catch { /* ignore */ }
    }

    this._tabManager.remove(id);

    if (!wasActive) return;

    if (adjacent) {
      await this.switchToTab(adjacent.id);
    } else if (!this._tabManager.isEmpty()) {
      await this.switchToTab(this._tabManager.getAll()[0].id);
    } else {
      // Last tab was closed — open a fresh blank diagram
      await this.addAndActivateTab();
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _initTabsAfterCreate(): Promise<void> {
    if (!this._modeler) return;

    if (this._tabManager.isEmpty()) {
      const tab = this._tabManager.add();
      await this._tabManager.activate(tab.id);
      try {
        this._tabManager.setLifecycle(tab.id, 'loading');
        await this._modeler.importXML(this._emptyXml);
        this._modeler.canvas.zoom('fit-viewport');
        await this._tabManager.snapshot(tab.id, this._emptyXml, null);
        this._tabManager.setLifecycle(tab.id, 'ready');
      } catch (err) {
        console.error('[csp-bpmn] Failed to load initial diagram:', err);
        this._tabManager.setLifecycle(tab.id, 'error');
      }
    } else {
      const active = this._tabManager.getActive();
      if (active) await this._loadTabXML(active);
    }
  }

  private async _loadTabXML(tab: TabMeta): Promise<void> {
    if (!this._modeler) return;

    this._tabManager.setLifecycle(tab.id, 'loading');
    try {
      const xml = (await this._tabManager.loadXml(tab.id)) || this._emptyXml;
      await this._modeler.importXML(xml);

      if (tab.viewbox) {
        this._modeler.setViewbox(tab.viewbox);
      } else {
        this._modeler.canvas.zoom('fit-viewport');
      }

      this._modeler.customPropertiesProvider?.clearStore();
      this._tabManager.setLifecycle(tab.id, 'ready');
    } catch (err) {
      console.error('[csp-bpmn] Failed to load tab XML:', err);
      this._tabManager.setLifecycle(tab.id, 'error');
    }
  }
}
