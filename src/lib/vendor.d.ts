/** Module declarations for packages without bundled TypeScript types. */

type BpmnModule = { [name: string]: unknown };

declare module '@bpmn-io/properties-panel' {
  export const TextFieldEntry: unknown;
  export const TextAreaEntry: unknown;
  export const CheckboxEntry: unknown;
  export const SelectEntry: unknown;
  export const ToggleSwitchEntry: unknown;
  export const NumberFieldEntry: unknown;
  export const PropertiesPanel: unknown;
  export function isTextFieldEntryEdited(node: unknown): boolean;
  export function isCheckboxEntryEdited(node: unknown): boolean;
  export function isSelectEntryEdited(node: unknown): boolean;
  export function isTextAreaEntryEdited(node: unknown): boolean;
  export function isToggleSwitchEntryEdited(node: unknown): boolean;
}

declare module 'bpmn-js-properties-panel' {
  export const BpmnPropertiesPanelModule: BpmnModule;
  export const BpmnPropertiesProviderModule: BpmnModule;
  export const CamundaPlatformPropertiesProviderModule: BpmnModule;
  export const ZeebePropertiesProviderModule: BpmnModule;
}

declare module 'diagram-js-grid' {
  const GridModule: BpmnModule;
  export default GridModule;
}

declare module 'activiti-bpmn-moddle/resources/activiti.json' {
  const schema: Record<string, unknown>;
  export default schema;
}

declare module 'camunda-bpmn-moddle/resources/camunda.json' {
  const schema: Record<string, unknown>;
  export default schema;
}

declare module 'diagram-js-minimap' {
  const MinimapModule: { [name: string]: unknown };
  export default MinimapModule;
}

declare module 'diagram-js/lib/draw/BaseRenderer' {
  export default class BaseRenderer {
    constructor(eventBus: unknown, priority: number);
    canRender(element: unknown): boolean;
    drawShape(parentNode: SVGGElement, element: unknown): SVGElement;
    drawConnection(parentNode: SVGGElement, element: unknown): SVGElement;
    getShapePath(element: unknown): string;
    getConnectionPath(element: unknown): string;
  }
}


declare module 'bpmn-js/lib/util/ModelUtil' {
  export function is(element: unknown, type: string): boolean;
  export function getBusinessObject(element: unknown): {
    $type: string;
    get(propName: string): unknown;
    [key: string]: unknown;
  };
}
