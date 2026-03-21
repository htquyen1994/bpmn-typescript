// @ts-ignore – untyped package declared in vendor.d.ts
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
// @ts-ignore
import { is } from 'bpmn-js/lib/util/ModelUtil';

import { getActivityColors, getEventColors, getGatewayColors } from './element-colors.js';

// Custom renderer runs before the default BpmnRenderer (priority 1000).
const PRIORITY = 1500;
const TASK_RX  = 10; // border-radius for activity cards

// ── Native SVG helpers (avoids tiny-svg named-export Rollup issue) ────────────

function svgAttr(el: SVGElement, attrs: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
}

function svgQuery(selector: string, parent: SVGElement): SVGElement | null {
  return parent.querySelector(selector);
}

// ── TypeScript-safe extend of untyped JS base class ──────────────────────────

const _Base = BaseRenderer as unknown as new (
  eventBus: unknown,
  priority: number,
) => {
  drawShape(parentNode: SVGGElement, element: unknown): SVGElement;
  drawConnection(parentNode: SVGGElement, element: unknown): SVGElement;
  getShapePath(element: unknown): string;
};

// ── Local shape type ──────────────────────────────────────────────────────────

interface Shape {
  id: string;
  type: string;
  width: number;
  height: number;
  labelTarget?: unknown;
}

// ── Minimal interface for the injected bpmnRenderer service ──────────────────

interface BpmnRendererService {
  drawShape(parentNode: SVGGElement, element: unknown): SVGElement;
  drawConnection(parentNode: SVGGElement, element: unknown): SVGElement;
  getShapePath(element: unknown): string;
}

// ── Renderer ─────────────────────────────────────────────────────────────────

export class CustomBpmnRenderer extends _Base {
  static $inject = ['eventBus', 'bpmnRenderer'];

  private readonly _bpmnRenderer: BpmnRendererService;

  constructor(eventBus: unknown, bpmnRenderer: BpmnRendererService) {
    super(eventBus, PRIORITY);
    this._bpmnRenderer = bpmnRenderer;
  }

  /**
   * Intercept all non-label shapes.
   * Labels have a `labelTarget` reference — skip those so bpmn-js handles them.
   */
  canRender(element: unknown): boolean {
    return !(element as Shape).labelTarget;
  }

  /**
   * Pattern B (additive): let the default renderer draw first to preserve
   * task-type icons (person, gear, envelope…) and BPMN markers, then augment.
   */
  drawShape(parentNode: SVGGElement, element: unknown): SVGElement {
    const shape = this._bpmnRenderer.drawShape(parentNode, element);

    if (is(element, 'bpmn:Activity')) {
      this._enhanceActivity(parentNode, element as Shape);
    } else if (is(element, 'bpmn:Event')) {
      this._enhanceEvent(parentNode, element as Shape);
    } else if (is(element, 'bpmn:Gateway')) {
      this._enhanceGateway(parentNode, element as Shape);
    }

    return shape;
  }

  drawConnection(parentNode: SVGGElement, element: unknown): SVGElement {
    return this._bpmnRenderer.drawConnection(parentNode, element);
  }

  /** Delegate hit-testing paths to the base renderer (already correct). */
  getShapePath(element: unknown): string {
    return this._bpmnRenderer.getShapePath(element);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /** Card style: rounded corners + per-type fill/stroke + CSS drop-shadow. */
  private _enhanceActivity(parentNode: SVGGElement, element: Shape): void {
    const rect = svgQuery('rect', parentNode) as SVGRectElement | null;
    if (!rect) return;

    const { fill, stroke } = getActivityColors(element.type);

    svgAttr(rect, {
      fill,
      stroke,
      rx:             TASK_RX,
      ry:             TASK_RX,
      'stroke-width': 1.5,
    });

    // CSS filter: drop-shadow applied via .csp-r-activity in renderer-styles.css
    parentNode.classList.add('csp-r-activity');
  }

  /**
   * Coloured event rings.
   * Preserves stroke-width — end events intentionally use thick border (stroke-width 7)
   * to signal process termination; intermediate events use thinner rings.
   */
  private _enhanceEvent(parentNode: SVGGElement, element: Shape): void {
    const circle = svgQuery('circle', parentNode) as SVGCircleElement | null;
    if (!circle) return;

    const { fill, stroke } = getEventColors(element.type);
    svgAttr(circle, { fill, stroke });

    parentNode.classList.add('csp-r-event');
  }

  /** Coloured gateway diamonds — type conveys semantic meaning via colour. */
  private _enhanceGateway(parentNode: SVGGElement, element: Shape): void {
    const polygon = svgQuery('polygon', parentNode) as SVGPolygonElement | null;
    if (!polygon) return;

    const { fill, stroke } = getGatewayColors(element.type);
    svgAttr(polygon, { fill, stroke, 'stroke-width': 1.5 });

    parentNode.classList.add('csp-r-gateway');
  }
}
