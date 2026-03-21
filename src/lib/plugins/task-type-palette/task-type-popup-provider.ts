import type { BpmnCanvas } from '../../studio/bpmn-modeler-extender.js';
import type { BpmnModeling, BpmnElementFactory, BpmnPopupMenu } from '../../core/bpmn-types.js';

/**
 * Registers a popup-menu provider under the key `'bpmn-task-types'`.
 *
 * Entries cover the BPMN task / activity types that are not individually
 * exposed in the default palette. Clicking an entry places the shape at the
 * centre of the current viewport.
 */
export class TaskTypePopupProvider {
  static $inject = ['popupMenu', 'elementFactory', 'modeling', 'canvas'];

  private readonly _elementFactory: BpmnElementFactory;
  private readonly _modeling: BpmnModeling;
  private readonly _canvas: BpmnCanvas;

  constructor(
    popupMenu: BpmnPopupMenu,
    elementFactory: BpmnElementFactory,
    modeling: BpmnModeling,
    canvas: BpmnCanvas,
  ) {
    popupMenu.registerProvider('bpmn-task-types', 1500, this);
    this._elementFactory = elementFactory;
    this._modeling       = modeling;
    this._canvas         = canvas;
  }

  getPopupMenuEntries(): Record<string, object> {
    const elementFactory = this._elementFactory;
    const modeling       = this._modeling;
    const canvas         = this._canvas;

    const createEntry = (type: string, label: string, className: string) => ({
      label,
      className,
      action() {
        const vb    = canvas.viewbox();
        const x     = Math.round(vb.x + vb.width  / 2);
        const y     = Math.round(vb.y + vb.height / 2);
        const shape = elementFactory.createShape({ type });
        modeling.createShape(shape, { x, y }, canvas.getRootElement());
      },
    });

    return {
      'task-service':       createEntry('bpmn:ServiceTask',      'Service Task',       'bpmn-icon-service-task'),
      'task-user':          createEntry('bpmn:UserTask',         'User Task',          'bpmn-icon-user-task'),
      'task-script':        createEntry('bpmn:ScriptTask',       'Script Task',        'bpmn-icon-script-task'),
      'task-business-rule': createEntry('bpmn:BusinessRuleTask', 'Business Rule Task', 'bpmn-icon-business-rule-task'),
      'task-send':          createEntry('bpmn:SendTask',         'Send Task',          'bpmn-icon-send-task'),
      'task-receive':       createEntry('bpmn:ReceiveTask',      'Receive Task',       'bpmn-icon-receive-task'),
      'task-manual':        createEntry('bpmn:ManualTask',       'Manual Task',        'bpmn-icon-manual-task'),
      'task-subprocess':    createEntry('bpmn:SubProcess',       'Sub Process',        'bpmn-icon-subprocess-collapsed'),
      'task-call-activity': createEntry('bpmn:CallActivity',     'Call Activity',      'bpmn-icon-call-activity'),
    };
  }
}
