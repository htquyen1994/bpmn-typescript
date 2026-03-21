import type { CSPBpmConfig, BpmStudioMode, BpmnEventType, BpmnEventCallback } from '../types.js';
import type { StudioComponent } from '../studio/csp-bpmn-studio.js';
import type { DiagramTabState, AddTabConfig as TabAddConfig } from '../tabs/types.js';

// Phase 1 output — the entire studio compiled to an IIFE string, inlined at build time.
// @ts-ignore – ?raw is a Vite build-time suffix; the file is produced by Phase 1.
import studioBundle from '../../../temp/studio-bundle.js?raw';

import type { CustomPropertyConfig, PropertyTarget } from '../custom-properties/types.js';

/**
 * Public facade that wraps the `<csp-bpmn-studio>` web component inside an
 * iframe (for CSS / DOM isolation).
 *
 * All styles and HTML are created inline — no separate studio HTML file needed.
 */
export class CSPBpm {
  private studioEl!: StudioComponent;
  private config!: CSPBpmConfig;
  private iframe: HTMLIFrameElement | null = null;


  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static async InitBpm(config: CSPBpmConfig): Promise<CSPBpm> {
    const instance = new CSPBpm();
    return await instance.init(config);
  }

  private async init(config: CSPBpmConfig): Promise<CSPBpm> {
    this.config = config;

    const htmlURL     = this.createStudioFrameURL();
    const frameStudio = this.createIframe(htmlURL);
    this.config.container.appendChild(frameStudio);
    this.iframe = frameStudio;

    await new Promise<void>((resolve) => {
      frameStudio.onload = () => resolve();
    });

    const frameWin = frameStudio.contentWindow as any;
    const frameDoc = frameWin?.document;
    if (!frameDoc) throw new Error('Cannot access iframe content');

    if (frameWin.customElements) {
      await frameWin.customElements.whenDefined('csp-bpmn-studio');
    }

    this.studioEl = frameDoc.querySelector('csp-bpmn-studio') as StudioComponent;
    if (!this.studioEl) throw new Error('Studio element not found in iframe');

    if (this.studioEl.ready) {
      await this.studioEl.ready;
    }

    this.studioEl.setProvider(config.provider ?? 'bpmn');
    this.studioEl.setMode(config.mode);

    if (config.onReady) config.onReady(this);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Diagram operations
  // ---------------------------------------------------------------------------

  async importXML(xml: string): Promise<void> {
    await this.studioEl.loadXML(xml);
  }

  async saveXML(): Promise<string | undefined> {
    return await this.studioEl.saveXML();
  }

  async saveSVG(): Promise<string | undefined> {
    return await this.studioEl.saveSVG();
  }

  // ---------------------------------------------------------------------------
  // Mode
  // ---------------------------------------------------------------------------

  setMode(mode: BpmStudioMode): void {
    this.studioEl.setMode(mode);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  on(event: BpmnEventType, callback: BpmnEventCallback): () => void {
    return this.studioEl.on(event, callback);
  }

  off(event: BpmnEventType, callback: BpmnEventCallback): void {
    this.studioEl.off(event, callback);
  }

  // ---------------------------------------------------------------------------
  // Zoom
  // ---------------------------------------------------------------------------

  zoomIn(): void  { this.studioEl.zoomIn(); }
  zoomOut(): void { this.studioEl.zoomOut(); }
  zoomFit(): void { this.studioEl.zoomFit(); }
  zoomReset(): void { this.studioEl.zoomReset(); }

  // ---------------------------------------------------------------------------
  // Undo / Redo
  // ---------------------------------------------------------------------------

  undo(): void { this.studioEl.undo(); }
  redo(): void { this.studioEl.redo(); }

  // ---------------------------------------------------------------------------
  // Element access
  // ---------------------------------------------------------------------------

  getElement(elementId: string) {
    return this.studioEl.getElement(elementId);
  }

  // ---------------------------------------------------------------------------
  // Custom Properties Panel — Facade API
  // (The panel renders inside the studio iframe; no external container needed.)
  // ---------------------------------------------------------------------------

  /**
   * @deprecated The custom-properties panel is now built into the studio.
   * This method is kept for API compatibility but does nothing.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mountCustomPanel(_container: HTMLElement): this {
    console.warn(
      '[csp-bpmn] mountCustomPanel() is no longer needed — ' +
      'the custom-properties panel is built into the studio layout.',
    );
    return this;
  }

  /**
   * Register one or more custom properties for a specific element or BPMN type.
   * Values are persisted into `bpmn:extensionElements` → `activiti:properties`.
   *
   * @param target  string (element ID) | `{ elementId }` | `{ bpmnType }`
   */
  addCustomProperty(
    target: string | PropertyTarget,
    config: CustomPropertyConfig | CustomPropertyConfig[],
  ): this {
    const configs = Array.isArray(config) ? config : [config];

    if (typeof target === 'string') {
      this.studioEl.registerCustomPropertyForElement(target, configs);
    } else if ('elementId' in target) {
      this.studioEl.registerCustomPropertyForElement(target.elementId, configs);
    } else {
      this.studioEl.registerCustomPropertyForType(target.bpmnType, configs);
    }

    return this;
  }

  /** Shorthand for `addCustomProperty({ bpmnType }, config)`. */
  addCustomPropertyForType(
    bpmnType: string,
    config: CustomPropertyConfig | CustomPropertyConfig[],
  ): this {
    return this.addCustomProperty({ bpmnType }, config);
  }

  /** Return stored custom-property values for a given element (reads from extensionElements). */
  getCustomValues(elementId: string): Record<string, unknown> {
    return this.studioEl.getCustomValues(elementId);
  }

  /** Programmatically write values into extensionElements for a given element. */
  setCustomValues(elementId: string, values: Record<string, unknown>): this {
    this.studioEl.setCustomValues(elementId, values);
    return this;
  }

  /** Validate all custom properties for the currently selected element. */
  validateCustomProperties(): boolean {
    return this.studioEl.validateCustomProperties();
  }

  // ---------------------------------------------------------------------------
  // Multi-tab API
  // ---------------------------------------------------------------------------

  /**
   * Add a new diagram tab and activate it.
   *
   * @example
   * const tab = await bpm.addTab({ title: 'Order Process', xml: orderXml });
   */
  async addTab(config?: TabAddConfig): Promise<DiagramTabState> {
    return this.studioEl.addTab(config);
  }

  /**
   * Switch to the tab with the given id.
   *
   * @returns `true` when the switch completed, `false` if cancelled or id not found.
   */
  async activateTab(id: string): Promise<boolean> {
    return this.studioEl.activateTab(id);
  }

  /**
   * Close the tab with the given id.
   * If it is the last tab, a new blank tab is opened automatically.
   */
  async closeTab(id: string): Promise<void> {
    return this.studioEl.closeTab(id);
  }

  /** Returns the id of the currently active tab, or null. */
  getActiveTabId(): string | null {
    return this.studioEl.getActiveTabId();
  }

  /** Returns all open tabs in display order. */
  getAllTabs(): DiagramTabState[] {
    return this.studioEl.getAllTabs();
  }

  /**
   * Copy the active diagram's XML to an internal clipboard, then return the XML.
   * Use `pasteFromClipboard()` to open it as a new tab.
   */
  async copyActiveTabToClipboard(): Promise<string | null> {
    return this.studioEl.copyActiveTabToClipboard();
  }

  /**
   * Open a new tab populated with the last copied XML (from `copyActiveTabToClipboard()`).
   * Returns the new tab, or null if the clipboard is empty.
   */
  async pasteFromClipboard(): Promise<DiagramTabState | null> {
    return this.studioEl.pasteFromClipboard();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.iframe?.remove();
    this.iframe = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private createIframe(src: string): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      width:    '100%',
      height:   '100%',
      border:   'none',
      overflow: 'hidden',
    });
    iframe.src = src;
    return iframe;
  }

  private createStudioFrameURL(): string {
    // Escape any literal </script> sequences inside the bundle so the HTML
    // parser does not prematurely close the inline <script> tag.
    const safeBundle = (studioBundle as string).replace(/<\/script>/gi, '<\\/script>');

    const content = `<!DOCTYPE html>
<html>
  <head>
    <style>
      body, html { margin:0; padding:0; overflow:hidden; height:100vh; width:100vw; }
      csp-bpmn-studio { display:block; height:100%; width:100%; }
    </style>
    <script>${safeBundle}<\/script>
  </head>
  <body>
    <csp-bpmn-studio></csp-bpmn-studio>
  </body>
</html>`;

    return URL.createObjectURL(new Blob([content], { type: 'text/html' }));
  }
}
