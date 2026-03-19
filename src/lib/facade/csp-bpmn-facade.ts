import type { CSPBpmConfig, BpmStudioMode, BpmnEventType, BpmnEventCallback } from '../types/index.js';
import type { StudioComponent } from '../studio/csp-bpmn-studio.js';

// Phase 1 output — the entire studio compiled to an IIFE string, inlined at build time.
// @ts-ignore – ?raw is a Vite build-time suffix; the file is produced by Phase 1.
import studioBundle from '../../../temp/studio-bundle.js?raw';

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

  /**
   * Factory – creates an iframe, loads the studio, waits until ready.
   */
  static async InitBpm(config: CSPBpmConfig): Promise<CSPBpm> {
    const instance = new CSPBpm();
    return await instance.init(config);
  }

  private async init(config: CSPBpmConfig): Promise<CSPBpm> {
    this.config = config;

    const htmlURL = this.createStudioFrameURL();
    const frameStudio = this.createIframe(htmlURL);
    this.config.container.appendChild(frameStudio);
    this.iframe = frameStudio;

    // Wait for iframe to load.
    await new Promise<void>((resolve) => {
      frameStudio.onload = () => resolve();
    });

    const frameWin = frameStudio.contentWindow as any;
    const frameDoc = frameWin?.document;
    if (!frameDoc) throw new Error('Cannot access iframe content');

    // Wait for the custom element to be defined inside the iframe.
    if (frameWin.customElements) {
      await frameWin.customElements.whenDefined('csp-bpmn-studio');
    }

    this.studioEl = frameDoc.querySelector('csp-bpmn-studio') as StudioComponent;
    if (!this.studioEl) throw new Error('Studio element not found in iframe');

    // Wait for the studio's own ready promise.
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

  zoomIn(): void { this.studioEl.zoomIn(); }
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
      width: '100%',
      height: '100%',
      border: 'none',
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
