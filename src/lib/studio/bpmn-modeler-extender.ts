import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import type { BpmnElement } from '../types.js';
import type { ViewboxSnapshot } from '../tabs/types.js';
import type {
  BpmnDiagramElement,
  BpmnModdle,
  BpmnModeling,
  BpmnMinimap,
  SelectionChangedEvent,
} from '../core/bpmn-types.js';

export type { BpmnDiagramElement };

// ─── Typed interfaces for bpmn-js internal services ─────────────────────────

export interface BpmnViewbox {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface BpmnCanvas {
  zoom(value?: number | 'fit-viewport', center?: { x: number; y: number }): number;
  scroll(delta: { dx: number; dy: number }): void;
  getRootElement(): { id: string; type: string };
  getContainer(): HTMLElement;
  viewbox(): BpmnViewbox;
  viewbox(box: { x: number; y: number; width: number; height: number }): void;
}

export interface BpmnEventBus {
  on(event: 'selection.changed', callback: (e: SelectionChangedEvent) => void): void;
  on(event: string, callback: (e: Record<string, unknown>) => void): void;
  off(event: string, callback: (e: Record<string, unknown>) => void): void;
  fire(event: string, data?: Record<string, unknown>): void;
}

export interface BpmnCommandStack {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

export interface BpmnElementRegistry {
  get(id: string): BpmnDiagramElement | undefined;
  getAll(): BpmnDiagramElement[];
  filter(fn: (el: BpmnDiagramElement) => boolean): BpmnDiagramElement[];
}

// ─── Type alias for a raw bpmn-js instance ──────────────────────────────────

type BpmnJsInstance = Modeler | NavigatedViewer;

// ─── Extender ────────────────────────────────────────────────────────────────

/**
 * Typed wrapper around a bpmn-js `Modeler` or `NavigatedViewer` instance.
 *
 * Replaces direct `import Modeler from 'bpmn-js/lib/Modeler'` usage in the
 * studio element and provides proper TypeScript types for all service accessors.
 */
export class BpmnModelerExtender {
  private readonly _instance: BpmnJsInstance;

  constructor(instance: BpmnJsInstance) {
    this._instance = instance;
  }

  // ── Service accessors ──────────────────────────────────────────────────────

  get canvas(): BpmnCanvas {
    return this._instance.get('canvas') as BpmnCanvas;
  }

  get eventBus(): BpmnEventBus {
    return this._instance.get('eventBus') as BpmnEventBus;
  }

  get commandStack(): BpmnCommandStack {
    return this._instance.get('commandStack') as BpmnCommandStack;
  }

  get elementRegistry(): BpmnElementRegistry {
    return this._instance.get('elementRegistry') as BpmnElementRegistry;
  }

  /** Raw bpmn-js moddle instance – used for low-level XML parse / serialise. */
  get moddle(): BpmnModdle {
    return this._instance.get('moddle') as BpmnModdle;
  }

  get modeling(): BpmnModeling {
    return this._instance.get('modeling') as BpmnModeling;
  }

  /** The in-memory store for reusable SubProcess XML snippets (modeler mode only). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get subprocessStore(): any {
    try { return this._instance.get('subprocessStore'); } catch { return null; }
  }

  /** Custom-properties provider (modeler mode only). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get customPropertiesProvider(): any {
    try { return this._instance.get('customPropertiesProvider'); } catch { return null; }
  }

  /** Minimap service (modeler mode only). */
  get minimap(): BpmnMinimap | null {
    try { return this._instance.get('minimap') as BpmnMinimap; } catch { return null; }
  }

  // ── Diagram operations ─────────────────────────────────────────────────────

  async importXML(xml: string): Promise<{ warnings: string[] }> {
    return this._instance.importXML(xml) as Promise<{ warnings: string[] }>;
  }

  async saveXML(options?: { format?: boolean }): Promise<{ xml: string }> {
    return this._instance.saveXML(options ?? {}) as Promise<{ xml: string }>;
  }

  async saveSVG(): Promise<{ svg: string }> {
    return this._instance.saveSVG() as Promise<{ svg: string }>;
  }

  // ── Element helpers ────────────────────────────────────────────────────────

  getElement(elementId: string): BpmnElement | null {
    const el = this.elementRegistry.get(elementId);
    if (!el) return null;
    return {
      id: el.id,
      type: el.type,
      name: el.businessObject?.name,
      parent: el.parent ? { id: el.parent.id } : undefined,
    };
  }

  // ── Viewport ───────────────────────────────────────────────────────────────

  /** Capture the current canvas viewport (zoom + scroll). Returns null on error. */
  getViewbox(): ViewboxSnapshot | null {
    try {
      const vb = this.canvas.viewbox();
      return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
    } catch {
      return null;
    }
  }

  /** Restore a previously captured viewport snapshot. */
  setViewbox(viewbox: ViewboxSnapshot): void {
    try {
      this.canvas.viewbox({
        x: viewbox.x, y: viewbox.y,
        width: viewbox.width, height: viewbox.height,
      });
    } catch { /* ignore */ }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  destroy(): void {
    try { this._instance.destroy(); } catch { /* ignore */ }
  }
}
