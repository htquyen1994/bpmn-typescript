/** Studio mode – determines whether the user can edit or only view. */
export type BpmStudioMode = 'modeler' | 'viewer';

/**
 * Properties-panel provider dialect.
 * - `bpmn`     – Standard BPMN 2.0 properties only (default).
 * - `camunda`  – Standard BPMN + Camunda Platform extensions.
 * - `activiti` – Standard BPMN + Activiti / Flowable extensions
 *                (compatible with Java Activiti back-end).
 */
export type BpmnProvider = 'bpmn' | 'camunda' | 'activiti';

/** Minimal representation of a BPMN element. */
export interface BpmnElement {
  id: string;
  type: string;
  name?: string;
  parent?: { id: string };
  businessObject?: Record<string, unknown>;
}

/** Supported BPMN event types forwarded by the studio. */
export type BpmnEventType =
  | 'element.click'
  | 'element.dblclick'
  | 'selection.changed'
  | 'commandStack.changed'
  | 'import.done';

/** Callback signature for BPMN events. */
export type BpmnEventCallback = (event: any) => void;

/** Configuration for CSPBpm.InitBpm(). */
export interface CSPBpmConfig {
  /** DOM element the iframe will be appended to. */
  container: HTMLElement;
  /** Modeler (edit) or viewer (read-only). */
  mode: BpmStudioMode;
  /**
   * Properties-panel dialect. Defaults to `'bpmn'`.
   * Use `'activiti'` when the back-end is Java Activiti / Flowable.
   * Use `'camunda'` when the back-end is Camunda Platform 7.
   */
  provider?: BpmnProvider;
  /** Called once the studio is fully ready. */
  onReady?: (instance: any) => void;
}

/** Result of exporting XML. */
export interface ExportXmlResult {
  xml: string;
}

/** Result of exporting SVG. */
export interface ExportSvgResult {
  svg: string;
}
