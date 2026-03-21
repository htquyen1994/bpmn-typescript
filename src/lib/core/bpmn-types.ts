/**
 * TypeScript structural interfaces for bpmn-js internal APIs.
 *
 * bpmn-js does not ship comprehensive TypeScript types, so we define minimal
 * structural interfaces for the services and moddle objects we actually use.
 * All interfaces are duck-typed — they describe only the surface we rely on.
 */

// ── Base moddle object ────────────────────────────────────────────────────────

/** Minimal base for any object created or parsed by bpmn-moddle. */
export interface BpmnBaseObject {
  $type: string;
  $parent?: BpmnBaseObject;
  [key: string]: unknown;
}

// ── Business objects (semantic layer) ────────────────────────────────────────

export interface BpmnBusinessObject extends BpmnBaseObject {
  id?: string;
  name?: string;
  extensionElements?: BpmnExtensionElements;
}

export interface BpmnExtensionElements extends BpmnBaseObject {
  $type: 'bpmn:ExtensionElements';
  values?: BpmnBaseObject[];
}

export interface ActivitiProperties extends BpmnBaseObject {
  $type: 'activiti:Properties';
  values?: ActivitiProperty[];
}

export interface ActivitiProperty extends BpmnBaseObject {
  $type: 'activiti:Property';
  name?: string;
  value?: string;
}

export interface BpmnFlowElement extends BpmnBusinessObject {
  // Marker interface — all flow elements (tasks, gateways, events, …) share this base.
}

export interface BpmnProcess extends BpmnBusinessObject {
  $type: 'bpmn:Process';
  flowElements?: BpmnFlowElement[];
}

export interface BpmnSubProcess extends BpmnBusinessObject {
  $type: 'bpmn:SubProcess';
  flowElements?: BpmnFlowElement[];
}

// ── Definitions (root of the parsed XML) ─────────────────────────────────────

export interface BpmnDefinitions extends BpmnBaseObject {
  $type: 'bpmn:Definitions';
  rootElements?: (BpmnProcess | BpmnBaseObject)[];
  diagrams?: BpmnDiDiagram[];
}

// ── DI layer (bpmndi / dc) ────────────────────────────────────────────────────

export interface DcBounds extends BpmnBaseObject {
  $type: 'dc:Bounds';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BpmnDiShape extends BpmnBaseObject {
  $type: 'bpmndi:BPMNShape';
  id?: string;
  bpmnElement?: BpmnBaseObject;
  isExpanded?: boolean;
  bounds?: DcBounds;
}

export interface BpmnDiPlane extends BpmnBaseObject {
  $type: 'bpmndi:BPMNPlane';
  id?: string;
  bpmnElement?: BpmnBaseObject;
  planeElement?: BpmnDiShape[];
}

export interface BpmnDiDiagram extends BpmnBaseObject {
  $type: 'bpmndi:BPMNDiagram';
  id?: string;
  plane?: BpmnDiPlane;
}

// ── Element registry entry ────────────────────────────────────────────────────

/**
 * The diagram-js shape/connection object returned by `elementRegistry.get()`.
 * It wraps the moddle business object and carries layout information.
 */
export interface BpmnDiagramElement {
  id: string;
  type: string;
  businessObject: BpmnBusinessObject;
  parent?: BpmnDiagramElement;
}

// ── Typed event payloads ──────────────────────────────────────────────────────

export interface SelectionChangedEvent {
  newSelection: BpmnDiagramElement[];
  oldSelection?: BpmnDiagramElement[];
}

// ── fromXML result ────────────────────────────────────────────────────────────

export interface BpmnFromXmlResult {
  rootElement: BpmnDefinitions;
  references?: unknown[];
  warnings?: string[];
}

// ── moddle service ────────────────────────────────────────────────────────────

export interface BpmnModdle {
  fromXML(xml: string): Promise<BpmnFromXmlResult>;
  toXML(element: BpmnDefinitions, options?: { format?: boolean }): Promise<{ xml: string }>;

  create(type: 'bpmn:ExtensionElements', props?: { values?: BpmnBaseObject[] }): BpmnExtensionElements;
  create(type: 'activiti:Properties',    props?: { values?: ActivitiProperty[] }): ActivitiProperties;
  create(type: 'activiti:Property',      props?: { name?: string; value?: string }): ActivitiProperty;
  create(type: 'bpmn:SubProcess',        props?: { id?: string; name?: string }): BpmnSubProcess;
  create(type: 'bpmndi:BPMNShape',       props?: { id?: string; bpmnElement?: BpmnBaseObject; isExpanded?: boolean }): BpmnDiShape;
  create(type: 'dc:Bounds',              props?: { x: number; y: number; width: number; height: number }): DcBounds;
  create(type: 'bpmndi:BPMNPlane',       props?: { id?: string; bpmnElement?: BpmnBaseObject }): BpmnDiPlane;
  create(type: 'bpmndi:BPMNDiagram',     props?: { id?: string }): BpmnDiDiagram;
  create(type: string,                   props?: Record<string, unknown>): BpmnBaseObject;
}

// ── modeling service ──────────────────────────────────────────────────────────

export interface BpmnModeling {
  updateProperties(element: BpmnDiagramElement, props: Record<string, unknown>): void;
  createShape(
    shape: BpmnDiagramElement,
    position: { x: number; y: number },
    parent: unknown,
  ): BpmnDiagramElement;
}

// ── elementFactory service ────────────────────────────────────────────────────

export interface BpmnElementFactory {
  createShape(attrs: { type: string; [key: string]: unknown }): BpmnDiagramElement;
}

// ── minimap service ───────────────────────────────────────────────────────────

export interface BpmnMinimap {
  toggle(): void;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

// ── palette service ───────────────────────────────────────────────────────────

export interface BpmnPalette {
  registerProvider(priority: number, provider: unknown): void;
}

// ── popup-menu service ────────────────────────────────────────────────────────

export interface BpmnPopupMenu {
  open(element: unknown, providerId: string, position: { x: number; y: number }): void;
  registerProvider(type: string, priority: number, provider: unknown): void;
}

// ── injector (bpmn-js DI) ─────────────────────────────────────────────────────

export interface BpmnInjector {
  get(name: string): unknown;
}
