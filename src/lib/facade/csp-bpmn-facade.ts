import type { CSPBpmConfig, BpmStudioMode, BpmnEventType, BpmnEventCallback } from '../types/index.js';
import type { StudioComponent } from '../studio/csp-bpmn-studio.js';

// Phase 1 output — the entire studio compiled to an IIFE string, inlined at build time.
// @ts-ignore – ?raw is a Vite build-time suffix; the file is produced by Phase 1.
import studioBundle from '../../../temp/studio-bundle.js?raw';

import { CustomPropertiesPanel } from '../custom-panel/index.js';
import type { CustomPropertyConfig, PropertyTarget } from '../custom-panel/types.js';

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

  // ── Custom Properties Panel ─────────────────────────────────────────────────
  private customPanel:        CustomPropertiesPanel | null = null;
  private customPanelUnsub:   (() => void) | null = null;

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
  // ---------------------------------------------------------------------------

  /**
   * Mount a `CustomPropertiesPanel` into the given DOM element.
   * Automatically subscribes to `selection.changed` to keep the panel in sync.
   *
   * Must be called **after** `await CSPBpm.InitBpm(...)`.
   *
   * @returns `this` for chaining.
   */
  mountCustomPanel(container: HTMLElement): this {
    // Tear down any previous panel binding
    this.customPanelUnsub?.();
    this.customPanelUnsub = null;

    this.customPanel = new CustomPropertiesPanel(container);

    // Subscribe to selection changes inside the iframe
    this.customPanelUnsub = this.on('selection.changed', (e: any) => {
      const el = (e?.newSelection as any[])?.[0] ?? null;
      this.customPanel!.onElementSelected(
        el
          ? {
              id:             el.id,
              type:           el.type,
              name:           el.businessObject?.name,
              parent:         el.parent ? { id: el.parent.id } : undefined,
              businessObject: el.businessObject,
            }
          : null,
      );
    });

    return this;
  }

  /**
   * Register one or more custom properties for a specific element or BPMN type.
   *
   * @param target
   *   - `string`         → element ID (shorthand for `{ elementId }`)
   *   - `{ elementId }`  → single element
   *   - `{ bpmnType }`   → all elements of that type (e.g. `'bpmn:UserTask'`)
   *
   * @example
   * // For a specific element:
   * bpm.addCustomProperty('Activity_01', { key: 'priority', type: 'text', label: 'Priority' });
   *
   * // For every UserTask:
   * bpm.addCustomProperty({ bpmnType: 'bpmn:UserTask' }, [
   *   { key: 'assignee', type: 'selection', label: 'Assignee', options: fetchUsers },
   * ]);
   */
  addCustomProperty(
    target: string | PropertyTarget,
    config: CustomPropertyConfig | CustomPropertyConfig[],
  ): this {
    if (!this.customPanel) {
      console.warn('[csp-bpmn] Call mountCustomPanel() before addCustomProperty().');
      return this;
    }
    const configs = Array.isArray(config) ? config : [config];

    if (typeof target === 'string') {
      this.customPanel.addPropertiesForElement(target, configs);
    } else if ('elementId' in target) {
      this.customPanel.addPropertiesForElement(target.elementId, configs);
    } else {
      this.customPanel.addPropertiesForType(target.bpmnType, configs);
    }

    return this;
  }

  /**
   * Shorthand for `addCustomProperty({ bpmnType }, config)`.
   *
   * @example
   * bpm.addCustomPropertyForType('bpmn:UserTask', assigneeConfig);
   */
  addCustomPropertyForType(
    bpmnType: string,
    config: CustomPropertyConfig | CustomPropertyConfig[],
  ): this {
    return this.addCustomProperty({ bpmnType }, config);
  }

  /**
   * Return all stored custom-property values for a given element.
   *
   * @example
   * bpm.on('element.click', (e) => {
   *   console.log(bpm.getCustomValues(e.element.id));
   * });
   */
  getCustomValues(elementId: string): Record<string, unknown> {
    return this.customPanel?.getValues(elementId) ?? {};
  }

  /**
   * Programmatically set values for a given element.
   * Triggers a re-render if that element is currently selected.
   */
  setCustomValues(elementId: string, values: Record<string, unknown>): this {
    this.customPanel?.setValues(elementId, values);
    return this;
  }

  /**
   * Validate all custom properties for the currently selected element.
   * Returns `true` when there are no validation errors.
   */
  validateCustomProperties(): boolean {
    return this.customPanel?.validate() ?? true;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.customPanelUnsub?.();
    this.customPanelUnsub = null;
    this.customPanel      = null;
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
