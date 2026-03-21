import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule, CamundaPlatformPropertiesProviderModule } from 'bpmn-js-properties-panel';
import GridModule from 'diagram-js-grid';

import activitiModdle from 'activiti-bpmn-moddle/resources/activiti.json';
import camundaModdle from 'camunda-bpmn-moddle/resources/camunda.json';

import { BaseComponent } from '../base/base-component.js';
import { BpmnModelerExtender } from './bpmn-modeler-extender.js';
import { ActivitiPropertiesProviderModule } from './activiti-properties-provider.js';
import { ReusableSubprocessModule, SubprocessCreator, SubprocessStore } from './reusable-subprocess/index.js';
import { TaskTypePaletteModule } from './task-type-palette/index.js';
import { CustomPropertiesModule } from '../custom-properties/bpmn-provider.js';
import { TabManager } from '../multi/tab-manager.js';
import { TabBarUI } from './tab-bar/index.js';
import { StudioLayout } from './studio-layout.js';
import { CanvasControls } from './canvas-controls.js';
import { BPMN_CORE_CSS, BPMN_PROPERTIES_CSS, STUDIO_LAYOUT_CSS } from './studio-styles.js';
import { MinimapModule, MINIMAP_CSS } from './minimap/index.js';
import type { LayoutElements } from './studio-layout.js';
import type { DiagramTabState, AddTabConfig as TabAddConfig } from '../multi/types.js';
import type { CustomPropertyConfig } from '../custom-properties/types.js';
import type { BpmStudioMode, BpmnProvider, BpmnEventType, BpmnEventCallback, BpmnElement } from '../types/index.js';

// ── Minimal blank BPMN 2.0 diagram ────────────────────────────────────────────

const EMPTY_DIAGRAM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  targetNamespace="http://bpmn.io/schema/bpmn"
  id="Definitions_1">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="159" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/**
 * `<csp-bpmn-studio>` – Web Component wrapping bpmn-js.
 *
 * Mode behaviour:
 *  - `modeler` (edit)  → palette, properties panel, grid, tab bar, and reusable-subprocess toolbar visible.
 *  - `viewer`          → read-only canvas only; tab bar hidden.
 *
 * Provider behaviour (modeler mode only):
 *  - `bpmn`     → standard BPMN 2.0 properties.
 *  - `camunda`  → BPMN + Camunda Platform 7 extensions.
 *  - `activiti` → BPMN + Activiti / Flowable extensions.
 */
export class CspBpmnStudioElement extends BaseComponent {
  private modeler:    BpmnModelerExtender | null = null;
  private _layout:    LayoutElements | null = null;
  private mode:       BpmStudioMode = 'modeler';
  private provider:   BpmnProvider = 'bpmn';
  private eventCleanups: Array<() => void> = [];

  private readonly _studioLayout = new StudioLayout();
  private _canvasControls: CanvasControls | null = null;

  // ── Multi-tab state ───────────────────────────────────────────────────────
  private readonly _tabManager = new TabManager({ defaultTitle: 'Diagram' });
  private _tabBarUI: TabBarUI | null = null;
  private _clipboardXml: string | null = null;
  /** True while an async tab switch is in progress — prevents re-entrant switches. */
  private _switching = false;
  /** Resolves when the initial tabs are loaded after createInstance(). */
  private _tabsReady: Promise<void> = Promise.resolve();

  // ---------------------------------------------------------------------------
  // BaseComponent lifecycle hooks
  // ---------------------------------------------------------------------------

  protected onConnect(): void {
    this._injectStyles();
    this._buildLayout();
    this.readyResolve();
  }

  protected onDisconnect(): void {
    this._canvasControls!.destroy();
    this._tabBarUI?.destroy();
    this._tabBarUI = null;
    this._destroyInstance();
  }

  // ---------------------------------------------------------------------------
  // Public API (called from facade via iframe DOM)
  // ---------------------------------------------------------------------------

  setProvider(provider: BpmnProvider): void {
    if (this.provider === provider) return;
    this.provider = provider;
    if (this.modeler && this._layout) {
      this._destroyInstance();
      this._createInstance();
    }
  }

  setMode(mode: BpmStudioMode): void {
    if (mode === this.mode && this.modeler) return;
    this.mode = mode;
    if (this._layout) {
      this._destroyInstance();
      this._studioLayout.applyMode(mode, this._layout);
      this._createInstance();
      this._canvasControls?.setMinimapSupported(mode === 'modeler');
    }
  }

  async loadXML(xml: string): Promise<void> {
    await this._tabsReady;
    if (!this.modeler) throw new Error('Studio not initialized');
    const { warnings } = await this.modeler.importXML(xml);
    if (warnings?.length) console.warn('bpmn-js import warnings:', warnings);
    this.modeler.canvas.zoom('fit-viewport');
    const activeId = this._tabManager.getActiveId();
    if (activeId) {
      this._tabManager.snapshot(activeId, xml, null);
      this._tabManager.markClean(activeId);
    }
  }

  async saveXML(): Promise<string | undefined> {
    if (!this.modeler) return undefined;
    const { xml } = await this.modeler.saveXML({ format: true });
    const activeId = this._tabManager.getActiveId();
    if (activeId && xml) {
      this._tabManager.snapshot(activeId, xml, this.modeler.getViewbox());
      this._tabManager.markClean(activeId);
    }
    return xml;
  }

  async saveSVG(): Promise<string | undefined> {
    if (!this.modeler) return undefined;
    const { svg } = await this.modeler.saveSVG();
    return svg;
  }

  on(event: BpmnEventType, callback: BpmnEventCallback): () => void {
    if (!this.modeler) throw new Error('Studio not initialized');
    this.modeler.eventBus.on(event, callback);
    const cleanup = () => {
      try { this.modeler?.eventBus.off(event, callback); } catch { /* already destroyed */ }
    };
    this.eventCleanups.push(cleanup);
    return cleanup;
  }

  off(event: BpmnEventType, callback: BpmnEventCallback): void {
    this.modeler?.eventBus.off(event, callback);
  }

  zoomIn():    void { if (this.modeler) this.modeler.canvas.zoom(this.modeler.canvas.zoom() * 1.1); }
  zoomOut():   void { if (this.modeler) this.modeler.canvas.zoom(this.modeler.canvas.zoom() * 0.9); }
  zoomReset(): void { this.modeler?.canvas.zoom(1.0); }
  zoomFit():   void { this.modeler?.canvas.zoom('fit-viewport'); }
  undo():      void { this.modeler?.commandStack.undo(); }
  redo():      void { this.modeler?.commandStack.redo(); }

  getElement(elementId: string): BpmnElement | null {
    return this.modeler?.getElement(elementId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Custom Properties Panel API
  // ---------------------------------------------------------------------------

  registerCustomPropertyForType(bpmnType: string, configs: CustomPropertyConfig[]): void {
    this.modeler?.customPropertiesProvider?.registerForType(bpmnType, configs);
  }

  registerCustomPropertyForElement(elementId: string, configs: CustomPropertyConfig[]): void {
    this.modeler?.customPropertiesProvider?.registerForElement(elementId, configs);
  }

  getCustomValues(elementId: string): Record<string, unknown> {
    return this.modeler?.customPropertiesProvider?.getValues(elementId) ?? {};
  }

  setCustomValues(elementId: string, values: Record<string, unknown>): void {
    this.modeler?.customPropertiesProvider?.setValues(elementId, values);
  }

  validateCustomProperties(): boolean {
    return this.modeler?.customPropertiesProvider?.validate() ?? true;
  }

  // ---------------------------------------------------------------------------
  // Multi-tab Public API
  // ---------------------------------------------------------------------------

  async addTab(config?: TabAddConfig): Promise<DiagramTabState> {
    return this._addAndActivateTab(config);
  }

  async activateTab(id: string): Promise<boolean> {
    return this._switchToTab(id);
  }

  async closeTab(id: string): Promise<void> {
    return this._onTabClose(id);
  }

  getActiveTabId(): string | null {
    return this._tabManager.getActiveId();
  }

  getAllTabs(): DiagramTabState[] {
    return this._tabManager.getAll();
  }

  async copyActiveTabToClipboard(): Promise<string | null> {
    if (!this.modeler) return null;
    const { xml } = await this.modeler.saveXML({ format: true });
    this._clipboardXml = xml ?? null;
    return this._clipboardXml;
  }

  async pasteFromClipboard(): Promise<DiagramTabState | null> {
    if (!this._clipboardXml) return null;
    return this._addAndActivateTab({ xml: this._clipboardXml });
  }

  // ---------------------------------------------------------------------------
  // Private – styles
  // ---------------------------------------------------------------------------

  private _injectStyles(): void {
    this.addStyles('bpmn-core',           BPMN_CORE_CSS);
    this.addStyles('bpmn-properties-panel', BPMN_PROPERTIES_CSS);
    this.addStyles('bpmn-studio-layout',  STUDIO_LAYOUT_CSS);
    this.addStyles('bpmn-minimap',        MINIMAP_CSS);
  }

  // ---------------------------------------------------------------------------
  // Private – layout
  // ---------------------------------------------------------------------------

  private _buildLayout(): void {
    this._layout = this._studioLayout.build(this, {
      onImportSpClick: () => this._studioLayout.triggerFileImport(this._layout!.fileInput),
      onFileSelected:  (file) => this._onFileSelected(file),
    });

    this._tabBarUI = new TabBarUI(this._tabManager, {
      onActivate: (id) => { void this._switchToTab(id); },
      onClose:    (id) => { void this._onTabClose(id); },
      onAdd:      ()   => { void this._addAndActivateTab(); },
      onRename:   (id, title) => { this._tabManager.patch(id, { title }); },
    });
    this._tabBarUI.mount(this._layout.tabBarContainer);

    this._canvasControls = new CanvasControls({
      onZoomIn:         () => this.zoomIn(),
      onZoomOut:        () => this.zoomOut(),
      onZoomFit:        () => this.zoomFit(),
      onZoomReset:      () => this.zoomReset(),
      onExportSvg:      () => this._downloadSvg(),
      onToggleMinimap:  () => {
        const minimap = this.modeler?.minimap;
        if (!minimap) return false;
        minimap.toggle();
        return minimap.isOpen() as boolean;
      },
    });
    this._canvasControls.mount(this._layout.canvasControlsContainer);

    this._studioLayout.applyMode(this.mode, this._layout);
  }

  // ---------------------------------------------------------------------------
  // Private – bpmn-js instance
  // ---------------------------------------------------------------------------

  private _createInstance(): void {
    if (!this._layout) return;

    if (this.mode === 'viewer') {
      this.modeler = new BpmnModelerExtender(
        new NavigatedViewer({ container: this._layout.canvasContainer }),
      );
      return;
    }

    const additionalModules: { [key: string]: unknown }[] = [
      BpmnPropertiesPanelModule,
      BpmnPropertiesProviderModule,
      GridModule,
      ReusableSubprocessModule,
      TaskTypePaletteModule,
      CustomPropertiesModule,
      MinimapModule,
    ];

    const moddleExtensions: Record<string, object> = {
      activiti: activitiModdle,
    };

    if (this.provider === 'activiti') {
      additionalModules.push(ActivitiPropertiesProviderModule);
    } else if (this.provider === 'camunda') {
      additionalModules.push(CamundaPlatformPropertiesProviderModule);
      moddleExtensions['camunda'] = camundaModdle;
    }

    this.modeler = new BpmnModelerExtender(
      new Modeler({
        container:        this._layout.canvasContainer,
        propertiesPanel:  { parent: this._layout.propertiesPanelContainer },
        additionalModules,
        moddleExtensions,
      }),
    );

    this.modeler.customPropertiesProvider?.setContainer(this._layout.customPanelContainer);

    this._wireSubprocessEvents();
    this._wireTabDirtyTracking();

    this._tabsReady = this._initTabsAfterCreate();
  }

  private _destroyInstance(): void {
    if (this.modeler) {
      const activeId = this._tabManager.getActiveId();
      if (activeId) {
        void this.modeler.saveXML({ format: true }).then(({ xml }) => {
          if (activeId && xml) {
            this._tabManager.snapshot(activeId, xml, this.modeler?.getViewbox() ?? null);
          }
        }).catch(() => { /* ignore */ });
      }
    }

    for (const cleanup of this.eventCleanups) cleanup();
    this.eventCleanups = [];
    this.modeler?.destroy();
    this.modeler = null;
  }

  // ---------------------------------------------------------------------------
  // Private – multi-tab logic
  // ---------------------------------------------------------------------------

  private async _initTabsAfterCreate(): Promise<void> {
    if (!this.modeler) return;

    if (this._tabManager.isEmpty()) {
      const tab = this._tabManager.add();
      await this._tabManager.activate(tab.id);
      try {
        this._tabManager.setLifecycle(tab.id, 'loading');
        await this.modeler.importXML(EMPTY_DIAGRAM_XML);
        this.modeler.canvas.zoom('fit-viewport');
        this._tabManager.snapshot(tab.id, EMPTY_DIAGRAM_XML, null);
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

  private async _loadTabXML(tab: DiagramTabState): Promise<void> {
    if (!this.modeler) return;

    this._tabManager.setLifecycle(tab.id, 'loading');
    try {
      const xml = tab.xml || EMPTY_DIAGRAM_XML;
      await this.modeler.importXML(xml);

      if (tab.viewbox) {
        this.modeler.setViewbox(tab.viewbox);
      } else {
        this.modeler.canvas.zoom('fit-viewport');
      }

      this.modeler.customPropertiesProvider?.clearStore();
      this._tabManager.setLifecycle(tab.id, 'ready');
    } catch (err) {
      console.error('[csp-bpmn] Failed to load tab XML:', err);
      this._tabManager.setLifecycle(tab.id, 'error');
    }
  }

  private async _switchToTab(nextId: string): Promise<boolean> {
    if (this._switching || !this.modeler) return false;

    this._switching = true;
    try {
      const currentId = this._tabManager.getActiveId();
      if (currentId) {
        try {
          const { xml } = await this.modeler.saveXML({ format: true });
          this._tabManager.snapshot(currentId, xml ?? '', this.modeler.getViewbox());
        } catch { /* ignore */ }
      }

      const ok = await this._tabManager.activate(nextId);
      if (!ok) return false;

      const nextTab = this._tabManager.getActive();
      if (nextTab) await this._loadTabXML(nextTab);

      return true;
    } finally {
      this._switching = false;
    }
  }

  private async _addAndActivateTab(config?: TabAddConfig): Promise<DiagramTabState> {
    const tab = this._tabManager.add(config);
    await this._switchToTab(tab.id);
    return tab;
  }

  private async _onTabClose(id: string): Promise<void> {
    if (!this._tabManager.has(id)) return;

    const wasActive = this._tabManager.getActiveId() === id;
    const adjacent  = this._tabManager.getAdjacentTo(id);

    if (wasActive && this.modeler) {
      try {
        const { xml } = await this.modeler.saveXML({ format: true });
        this._tabManager.snapshot(id, xml ?? '', this.modeler.getViewbox());
      } catch { /* ignore */ }
    }

    this._tabManager.remove(id);

    if (!wasActive) return;

    if (adjacent) {
      await this._switchToTab(adjacent.id);
    } else if (!this._tabManager.isEmpty()) {
      await this._switchToTab(this._tabManager.getAll()[0].id);
    } else {
      await this._addAndActivateTab();
    }
  }

  private _wireTabDirtyTracking(): void {
    if (!this.modeler) return;

    const onChanged = (): void => {
      if (this._switching) return;
      const activeId = this._tabManager.getActiveId();
      if (activeId) this._tabManager.markDirty(activeId);
    };

    this.modeler.eventBus.on('commandStack.changed', onChanged);
    this.eventCleanups.push(() => {
      try { this.modeler?.eventBus.off('commandStack.changed', onChanged); } catch { /* ignore */ }
    });
  }

  // ---------------------------------------------------------------------------
  // Private – SVG export download
  // ---------------------------------------------------------------------------

  private async _downloadSvg(): Promise<void> {
    if (!this.modeler) return;
    try {
      const { svg } = await this.modeler.saveSVG();
      if (!svg) return;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'diagram.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[csp-bpmn] SVG export failed:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Private – reusable subprocess wiring
  // ---------------------------------------------------------------------------

  private _wireSubprocessEvents(): void {
    if (!this.modeler) return;
    const eb = this.modeler.eventBus;

    const onImportRequest = () =>
      this._studioLayout.triggerFileImport(this._layout!.fileInput);
    const onCreateRequest = (e: any) => this._handleSubprocessCreate(e.item);

    eb.on('subprocess.import-request', onImportRequest);
    eb.on('subprocess.create',         onCreateRequest);

    this.eventCleanups.push(
      () => { try { eb.off('subprocess.import-request', onImportRequest); } catch { /**/ } },
      () => { try { eb.off('subprocess.create',         onCreateRequest); } catch { /**/ } },
    );
  }

  private _onFileSelected(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const xml = e.target?.result as string;
      if (!xml || !this.modeler) return;

      const store = this.modeler.subprocessStore as SubprocessStore | null;
      if (!store) return;

      const item = SubprocessStore.itemFromXml(xml);
      store.add(item);
      console.info(`[csp-bpmn] SubProcess stored: "${item.name}" (${item.storeId})`);
    };
    reader.readAsText(file);
  }

  private async _handleSubprocessCreate(item: unknown): Promise<void> {
    if (!this.modeler || !item) return;
    try {
      const creator = new SubprocessCreator(this.modeler);
      await creator.createFromItem(item as any);
    } catch (err) {
      console.error('[csp-bpmn] Failed to create reusable SubProcess:', err);
    }
  }
}

// Register the custom element.
if (typeof customElements !== 'undefined' && !customElements.get('csp-bpmn-studio')) {
  customElements.define('csp-bpmn-studio', CspBpmnStudioElement);
}

export type StudioComponent = CspBpmnStudioElement;
