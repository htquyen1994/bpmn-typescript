import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule, CamundaPlatformPropertiesProviderModule } from 'bpmn-js-properties-panel';
import GridModule from 'diagram-js-grid';

// @ts-ignore – Vite ?inline suffix resolves at build time
import diagramCss from 'bpmn-js/dist/assets/diagram-js.css?inline';
// @ts-ignore
import bpmnCss from 'bpmn-js/dist/assets/bpmn-js.css?inline';
// @ts-ignore
import bpmnFontCss from 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css?inline';
// @ts-ignore
import propertiesPanelCss from '@bpmn-io/properties-panel/dist/assets/properties-panel.css?inline';

import activitiModdle from 'activiti-bpmn-moddle/resources/activiti.json';
import camundaModdle from 'camunda-bpmn-moddle/resources/camunda.json';

import { BaseComponent } from '../base/base-component.js';
import { BpmnModelerExtender } from './bpmn-modeler-extender.js';
import { ActivitiPropertiesProviderModule } from './activiti-properties-provider.js';
import { ReusableSubprocessModule, SubprocessCreator, SubprocessStore } from './reusable-subprocess/index.js';
import { TaskTypePaletteModule } from './task-type-palette/index.js';
import { CustomPropertiesModule } from './custom-properties/index.js';
import type { CustomPropertyConfig } from '../custom-panel/types.js';
import type { BpmStudioMode, BpmnProvider, BpmnEventType, BpmnEventCallback, BpmnElement } from '../types/index.js';

/**
 * `<csp-bpmn-studio>` – Web Component wrapping bpmn-js.
 *
 * Mode behaviour:
 *  - `modeler` (edit)  → palette, properties panel, grid, and reusable-subprocess toolbar visible.
 *  - `viewer`          → read-only canvas only.
 *
 * Provider behaviour (modeler mode only):
 *  - `bpmn`     → standard BPMN 2.0 properties.
 *  - `camunda`  → BPMN + Camunda Platform 7 extensions.
 *  - `activiti` → BPMN + Activiti / Flowable extensions.
 */
export class CspBpmnStudioElement extends BaseComponent {
  private modeler:                    BpmnModelerExtender | null = null;
  private canvasContainer:            HTMLDivElement | null = null;
  private propertiesPanelContainer:   HTMLDivElement | null = null;
  private customPanelContainer:       HTMLDivElement | null = null;
  private customPanelToggle:          HTMLDivElement | null = null;
  private toolbarContainer:           HTMLDivElement | null = null;
  private fileInput:                  HTMLInputElement | null = null;
  private mode:                       BpmStudioMode = 'modeler';
  private provider:                   BpmnProvider = 'bpmn';
  private eventCleanups:              Array<() => void> = [];

  // ---------------------------------------------------------------------------
  // BaseComponent lifecycle hooks
  // ---------------------------------------------------------------------------

  protected onConnect(): void {
    this.injectAllStyles();
    this.buildLayout();
    this.readyResolve();
  }

  protected onDisconnect(): void {
    this.destroyInstance();
  }

  // ---------------------------------------------------------------------------
  // Public API (called from facade via iframe DOM)
  // ---------------------------------------------------------------------------

  setProvider(provider: BpmnProvider): void {
    if (this.provider === provider) return;
    this.provider = provider;
    if (this.modeler && this.canvasContainer) {
      this.destroyInstance();
      this.createInstance();
    }
  }

  setMode(mode: BpmStudioMode): void {
    if (mode === this.mode && this.modeler) return;
    this.mode = mode;
    if (this.canvasContainer) {
      this.destroyInstance();
      this.applyModeLayout();
      this.createInstance();
    }
  }

  async loadXML(xml: string): Promise<void> {
    if (!this.modeler) throw new Error('Studio not initialized');
    const { warnings } = await this.modeler.importXML(xml);
    if (warnings?.length) console.warn('bpmn-js import warnings:', warnings);
    this.modeler.canvas.zoom('fit-viewport');
  }

  async saveXML(): Promise<string | undefined> {
    if (!this.modeler) return undefined;
    const { xml } = await this.modeler.saveXML({ format: true });
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

  zoomIn(): void {
    if (!this.modeler) return;
    this.modeler.canvas.zoom(this.modeler.canvas.zoom() * 1.1);
  }

  zoomOut(): void {
    if (!this.modeler) return;
    this.modeler.canvas.zoom(this.modeler.canvas.zoom() * 0.9);
  }

  zoomReset(): void { this.modeler?.canvas.zoom(1.0); }
  zoomFit():   void { this.modeler?.canvas.zoom('fit-viewport'); }
  undo():      void { this.modeler?.commandStack.undo(); }
  redo():      void { this.modeler?.commandStack.redo(); }

  getElement(elementId: string): BpmnElement | null {
    return this.modeler?.getElement(elementId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Custom Properties Panel API (delegated to CustomPropertiesProvider)
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
  // Private – layout
  // ---------------------------------------------------------------------------

  private injectAllStyles(): void {
    this.addStyles('bpmn-core', [diagramCss, bpmnCss, bpmnFontCss].join('\n'));
    this.addStyles('bpmn-properties-panel', propertiesPanelCss);
    this.addStyles('bpmn-studio-layout', `
      csp-bpmn-studio {
        display: flex !important;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      .bpmn-toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        flex-shrink: 0;
        font-family: sans-serif;
        font-size: 12px;
      }
      .bpmn-toolbar-label {
        color: #666;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .03em;
        margin-right: 2px;
      }
      .bpmn-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border: 1px solid #c8c8c8;
        border-radius: 3px;
        background: #fff;
        cursor: pointer;
        font-size: 12px;
        color: #333;
        white-space: nowrap;
      }
      .bpmn-btn:hover { background: #e8f0fe; border-color: #4a90d9; color: #1a73e8; }

      /* ── Palette custom icons ───────────────────────────────────────────── */
      /* Three-dots "More task types" button */
      .djs-palette .entry.csp-palette-task-type-more {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='5' cy='12' r='2.5' fill='%23333'/%3E%3Ccircle cx='12' cy='12' r='2.5' fill='%23333'/%3E%3Ccircle cx='19' cy='12' r='2.5' fill='%23333'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: center;
        background-size: 60%;
      }
      .djs-palette .entry.csp-palette-task-type-more:hover {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='5' cy='12' r='2.5' fill='%231a73e8'/%3E%3Ccircle cx='12' cy='12' r='2.5' fill='%231a73e8'/%3E%3Ccircle cx='19' cy='12' r='2.5' fill='%231a73e8'/%3E%3C/svg%3E");
      }
      /* Import SubProcess – upload arrow */
      .djs-palette .entry.csp-palette-import-sp {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/%3E%3Cpolyline points='17 8 12 3 7 8'/%3E%3Cline x1='12' y1='3' x2='12' y2='15'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: center;
        background-size: 55%;
      }
      .djs-palette .entry.csp-palette-import-sp:hover {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a73e8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/%3E%3Cpolyline points='17 8 12 3 7 8'/%3E%3Cline x1='12' y1='3' x2='12' y2='15'/%3E%3C/svg%3E");
      }
      .bpmn-main-area {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      }
      .bpmn-canvas-container {
        flex: 1;
        position: relative;
        min-width: 0;
      }
      /* Allow the palette to overflow the canvas container vertically */
      .bpmn-canvas-container .djs-container {
        overflow: visible;
      }
      .bpmn-canvas-container .djs-canvas {
        overflow: hidden;
      }
      .djs-palette .djs-palette-entries {
        overflow-y: auto;
        max-height: calc(100vh - 120px);
      }
      /* ── Right panel (bpmn-js props + custom panel) ────────────────────── */
      .bpmn-right-panel {
        width: 300px;
        min-width: 300px;
        display: flex;
        flex-direction: column;
        border-left: 1px solid #e0e0e0;
        overflow: hidden;
      }
      .bpmn-properties-container {
        flex: 1;
        min-height: 80px;
        overflow-y: auto;
        background: #fafafa;
      }
      /* ── Custom panel toggle ─────────────────────────────────────────────── */
      .csp-custom-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        background: #eeeeee;
        border-top: 1px solid #d5d5d5;
        border-bottom: 1px solid #d5d5d5;
        cursor: pointer;
        flex-shrink: 0;
        font-family: system-ui, sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .04em;
        text-transform: uppercase;
        color: #555;
        user-select: none;
      }
      .csp-custom-toggle:hover { background: #e2e2e2; }
      .csp-custom-toggle-arrow { font-size: 10px; }
      /* ── Custom panel body ───────────────────────────────────────────────── */
      .csp-custom-panel-body {
        height: 300px;
        overflow-y: auto;
        background: #fafafa;
        flex-shrink: 0;
      }
      .csp-custom-panel-body.csp-collapsed { display: none; }
    `);
  }

  private buildLayout(): void {
    this.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

    // Toolbar (hidden in viewer mode)
    this.toolbarContainer = document.createElement('div');
    this.toolbarContainer.className = 'bpmn-toolbar';
    this.toolbarContainer.innerHTML = `
      <span class="bpmn-toolbar-label">SubProcess</span>
      <button class="bpmn-btn" id="btn-import-sp" title="Load a .bpmn file to add it as a reusable SubProcess">
        ⊕ Import XML
      </button>
    `;
    this.toolbarContainer.querySelector('#btn-import-sp')!
      .addEventListener('click', () => this.triggerFileImport());
    this.appendChild(this.toolbarContainer);

    // Hidden file input
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.bpmn,.xml';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', () => this.onFileSelected());
    this.appendChild(this.fileInput);

    // Main area (canvas + properties panel)
    const mainArea = document.createElement('div');
    mainArea.className = 'bpmn-main-area';
    this.appendChild(mainArea);

    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'bpmn-canvas-container';
    mainArea.appendChild(this.canvasContainer);

    // ── Right panel: bpmn-js properties + custom properties ──────────────────
    const rightPanel = document.createElement('div');
    rightPanel.className = 'bpmn-right-panel';
    mainArea.appendChild(rightPanel);

    this.propertiesPanelContainer = document.createElement('div');
    this.propertiesPanelContainer.className = 'bpmn-properties-container';
    rightPanel.appendChild(this.propertiesPanelContainer);

    // Toggle button
    this.customPanelToggle = document.createElement('div');
    this.customPanelToggle.className = 'csp-custom-toggle';
    this.customPanelToggle.innerHTML =
      '<span>Custom Properties</span><span class="csp-custom-toggle-arrow">▼</span>';
    rightPanel.appendChild(this.customPanelToggle);

    // Custom panel body (initially open)
    this.customPanelContainer = document.createElement('div');
    this.customPanelContainer.className = 'csp-custom-panel-body';
    rightPanel.appendChild(this.customPanelContainer);

    this.customPanelToggle.addEventListener('click', () => {
      const collapsed = this.customPanelContainer!.classList.toggle('csp-collapsed');
      this.customPanelToggle!.querySelector('.csp-custom-toggle-arrow')!.textContent =
        collapsed ? '▶' : '▼';
    });

    this.applyModeLayout();
  }

  private applyModeLayout(): void {
    const isModeler = this.mode === 'modeler';
    if (this.toolbarContainer)     this.toolbarContainer.style.display     = isModeler ? '' : 'none';
    // Hide the whole right panel (both bpmn-js props + custom panel) in viewer mode.
    if (this.propertiesPanelContainer) {
      const rightPanel = this.propertiesPanelContainer.parentElement;
      if (rightPanel) rightPanel.style.display = isModeler ? '' : 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // Private – bpmn-js instance
  // ---------------------------------------------------------------------------

  private createInstance(): void {
    if (!this.canvasContainer) return;

    if (this.mode === 'viewer') {
      this.modeler = new BpmnModelerExtender(
        new NavigatedViewer({ container: this.canvasContainer }),
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
    ];

    // activiti moddle is always registered so activiti:Properties can be used
    // as the extensionElements storage format regardless of the active provider.
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
        container:        this.canvasContainer,
        propertiesPanel:  { parent: this.propertiesPanelContainer! },
        additionalModules,
        moddleExtensions,
      }),
    );

    // Wire custom panel container into the provider.
    if (this.customPanelContainer) {
      this.modeler.customPropertiesProvider?.setContainer(this.customPanelContainer);
    }

    this.wireSubprocessEvents();
  }

  private destroyInstance(): void {
    for (const cleanup of this.eventCleanups) cleanup();
    this.eventCleanups = [];
    this.modeler?.destroy();
    this.modeler = null;
  }

  // ---------------------------------------------------------------------------
  // Private – reusable subprocess wiring
  // ---------------------------------------------------------------------------

  /**
   * Listen for events fired by the bpmn-js module:
   *  - `subprocess.import-request` → open file picker.
   *  - `subprocess.create`         → merge XML + re-import.
   */
  private wireSubprocessEvents(): void {
    if (!this.modeler) return;
    const eb = this.modeler.eventBus;

    const onImportRequest = () => this.triggerFileImport();
    const onCreateRequest = (e: any) => this.handleSubprocessCreate(e.item);

    eb.on('subprocess.import-request', onImportRequest);
    eb.on('subprocess.create',         onCreateRequest);

    this.eventCleanups.push(
      () => { try { eb.off('subprocess.import-request', onImportRequest); } catch { /**/ } },
      () => { try { eb.off('subprocess.create',         onCreateRequest); } catch { /**/ } },
    );
  }

  private triggerFileImport(): void {
    this.fileInput?.click();
  }

  private onFileSelected(): void {
    const file = this.fileInput?.files?.[0];
    if (!file) return;

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

    // Reset so the same file can be re-imported
    if (this.fileInput) this.fileInput.value = '';
  }

  private async handleSubprocessCreate(item: unknown): Promise<void> {
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
