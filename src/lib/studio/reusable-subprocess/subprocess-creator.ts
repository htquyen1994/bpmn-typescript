import type { SubprocessItem } from './subprocess-store.js';
import type { BpmnModelerExtender } from '../bpmn-modeler-extender.js';

/**
 * Merges a stored SubProcess XML into the live diagram and re-imports.
 *
 * Algorithm:
 *  1. Export current diagram XML.
 *  2. Parse current + stored XML with the bpmn-js moddle instance.
 *  3. Remap all IDs in the stored XML to avoid conflicts.
 *  4. Create a collapsed `bpmn:SubProcess` element wrapping the inner elements.
 *  5. Append it to the current `bpmn:Process`.
 *  6. Build a separate `bpmndi:BPMNDiagram` / `bpmndi:BPMNPlane` for drill-down.
 *  7. Serialize with `moddle.toXML()` and re-import.
 */
export class SubprocessCreator {
  constructor(private readonly extender: BpmnModelerExtender) {}

  async createFromItem(item: SubprocessItem): Promise<void> {
    const moddle = this.extender.moddle;

    // ── 1. Save current state ───────────────────────────────────────────────
    const { xml: currentXml } = await this.extender.saveXML({ format: false });
    if (!currentXml) throw new Error('Cannot save current diagram XML');

    // ── 2. Parse both XMLs ──────────────────────────────────────────────────
    const { rootElement: currentDefs } = await moddle.fromXML(currentXml) as { rootElement: any };
    const { rootElement: sourceDefs }  = await moddle.fromXML(item.xml)   as { rootElement: any };

    // ── 3. Remap all IDs in source to avoid collisions ──────────────────────
    const prefix = 'rsp' + Date.now().toString(36).slice(-5) + '_';
    const spId   = prefix + 'sp';
    this._remapIds(sourceDefs, prefix);

    // ── 4. Locate source process & DI ───────────────────────────────────────
    const rootEls: any[] = sourceDefs.rootElements ?? [];
    const sourceProcess  = rootEls.find((e: any) => e.$type === 'bpmn:Process');
    if (!sourceProcess) throw new Error('Source XML contains no bpmn:Process');

    const sourceDiagram: any = sourceDefs.diagrams?.[0];
    const sourcePlane: any   = sourceDiagram?.plane;

    // ── 5. Create collapsed SubProcess element ──────────────────────────────
    const subProcessBo: any = moddle.create('bpmn:SubProcess', {
      id:              spId,
      name:            item.name,
    });
    subProcessBo.flowElements = sourceProcess.flowElements ?? [];
    for (const fe of subProcessBo.flowElements) fe.$parent = subProcessBo;

    // ── 6. Attach to current process ────────────────────────────────────────
    const currentProcess: any = (currentDefs.rootElements as any[])
      .find((e: any) => e.$type === 'bpmn:Process');
    if (!currentProcess) throw new Error('Current diagram contains no bpmn:Process');

    currentProcess.flowElements = currentProcess.flowElements ?? [];
    subProcessBo.$parent = currentProcess;
    currentProcess.flowElements.push(subProcessBo);

    // ── 7. Outer DI shape (collapsed) ───────────────────────────────────────
    const vb    = this.extender.canvas.viewbox();
    const dropX = Math.round(vb.x + vb.width  / 2 - 50);
    const dropY = Math.round(vb.y + vb.height / 2 - 40);

    const outerShape: any = moddle.create('bpmndi:BPMNShape', {
      id:         spId + '_di',
      bpmnElement: subProcessBo,
      isExpanded: false,
    });
    outerShape.bounds = moddle.create('dc:Bounds', {
      x: dropX, y: dropY, width: 100, height: 80,
    });

    const currentDiagram: any = currentDefs.diagrams?.[0];
    if (currentDiagram?.plane) {
      currentDiagram.plane.planeElement = currentDiagram.plane.planeElement ?? [];
      currentDiagram.plane.planeElement.push(outerShape);
    }

    // ── 8. Inner diagram plane (enables drill-down) ─────────────────────────
    const innerPlane: any = moddle.create('bpmndi:BPMNPlane', {
      id:          spId + '_plane',
      bpmnElement: subProcessBo,
    });
    innerPlane.planeElement = sourcePlane?.planeElement ?? [];

    const innerDiagram: any = moddle.create('bpmndi:BPMNDiagram', {
      id: 'BPMNDiagram_' + spId,
    });
    innerDiagram.plane = innerPlane;

    currentDefs.diagrams = currentDefs.diagrams ?? [];
    currentDefs.diagrams.push(innerDiagram);

    // ── 9. Serialize & re-import ────────────────────────────────────────────
    const { xml: mergedXml } = await moddle.toXML(currentDefs, { format: true }) as { xml: string };
    await this.extender.importXML(mergedXml);
    this.extender.canvas.zoom('fit-viewport');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Walk the entire moddle object graph and prefix every `id` property.
   * Uses a visited-set to handle circular `$parent` / reference pointers.
   */
  private _remapIds(obj: unknown, prefix: string, visited = new Set<object>()): void {
    if (!obj || typeof obj !== 'object') return;
    if (visited.has(obj as object)) return;
    visited.add(obj as object);

    if (Array.isArray(obj)) {
      for (const item of obj) this._remapIds(item, prefix, visited);
      return;
    }

    const record = obj as Record<string, unknown>;
    if (typeof record['id'] === 'string') {
      record['id'] = prefix + record['id'];
    }

    for (const key of Object.keys(record)) {
      // Skip internal moddle meta-properties to avoid infinite loops.
      if (key === '$type' || key === '$parent' || key === '$model' || key === '$descriptor') continue;
      this._remapIds(record[key], prefix, visited);
    }
  }
}
