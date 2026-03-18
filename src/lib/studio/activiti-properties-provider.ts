import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';
import {
  TextFieldEntry,
  CheckboxEntry,
  isTextFieldEntryEdited,
  isCheckboxEntryEdited,
} from '@bpmn-io/properties-panel';

// ─── Types ────────────────────────────────────────────────────────────────────

type Translate = (template: string, replacements?: Record<string, string>) => string;

interface Entry {
  id: string;
  element: unknown;
  component: unknown;
  isEdited?: unknown;
  label: string;
  getValue: () => unknown;
  setValue: (value: unknown) => void;
}

interface Group {
  id: string;
  label: string;
  entries: Entry[];
}

// ─── Entry helpers ────────────────────────────────────────────────────────────

function textEntry(
  id: string,
  label: string,
  element: unknown,
  propKey: string,
  modeling: any,
  translate: Translate,
): Entry {
  const bo = getBusinessObject(element as any);
  return {
    id,
    element,
    component: TextFieldEntry,
    isEdited: isTextFieldEntryEdited,
    label: translate(label),
    getValue: () => (bo.get(propKey) as string | undefined) ?? '',
    setValue: (value: unknown) =>
      modeling.updateProperties(element, { [propKey]: (value as string) || undefined }),
  };
}

function checkEntry(
  id: string,
  label: string,
  element: unknown,
  propKey: string,
  modeling: any,
  translate: Translate,
): Entry {
  const bo = getBusinessObject(element as any);
  return {
    id,
    element,
    component: CheckboxEntry,
    isEdited: isCheckboxEntryEdited,
    label: translate(label),
    getValue: () => (bo.get(propKey) as boolean | undefined) ?? false,
    setValue: (value: unknown) =>
      modeling.updateProperties(element, { [propKey]: value as boolean }),
  };
}

// ─── Groups ───────────────────────────────────────────────────────────────────

/**
 * async / exclusive — available on all Activities, Gateways, Events.
 */
function executionGroup(element: unknown, injector: any, translate: Translate): Group {
  const modeling = injector.get('modeling');
  return {
    id: 'activitiExecution',
    label: translate('Execution (Activiti)'),
    entries: [
      checkEntry('activiti-async', 'Asynchronous', element, 'activiti:async', modeling, translate),
      checkEntry('activiti-exclusive', 'Exclusive', element, 'activiti:exclusive', modeling, translate),
    ],
  };
}

/**
 * assignee / candidates / form / due / priority — bpmn:UserTask.
 */
function userTaskGroup(element: unknown, injector: any, translate: Translate): Group {
  const modeling = injector.get('modeling');
  return {
    id: 'activitiUserTask',
    label: translate('User Task (Activiti)'),
    entries: [
      textEntry('activiti-assignee', 'Assignee', element, 'activiti:assignee', modeling, translate),
      textEntry('activiti-candidateGroups', 'Candidate Groups', element, 'activiti:candidateGroups', modeling, translate),
      textEntry('activiti-candidateUsers', 'Candidate Users', element, 'activiti:candidateUsers', modeling, translate),
      textEntry('activiti-formKey', 'Form Key', element, 'activiti:formKey', modeling, translate),
      textEntry('activiti-dueDate', 'Due Date', element, 'activiti:dueDate', modeling, translate),
      textEntry('activiti-followUpDate', 'Follow-up Date', element, 'activiti:followUpDate', modeling, translate),
      textEntry('activiti-priority', 'Priority', element, 'activiti:priority', modeling, translate),
    ],
  };
}

/**
 * class / expression / delegateExpression / resultVariable — bpmn:ServiceTask,
 * bpmn:BusinessRuleTask, bpmn:SendTask.
 */
function serviceTaskGroup(element: unknown, injector: any, translate: Translate): Group {
  const modeling = injector.get('modeling');
  return {
    id: 'activitiServiceTask',
    label: translate('Service Task (Activiti)'),
    entries: [
      textEntry('activiti-class', 'Java Class', element, 'activiti:class', modeling, translate),
      textEntry('activiti-expression', 'Expression', element, 'activiti:expression', modeling, translate),
      textEntry('activiti-delegateExpression', 'Delegate Expression', element, 'activiti:delegateExpression', modeling, translate),
      textEntry('activiti-resultVariable', 'Result Variable', element, 'activiti:resultVariable', modeling, translate),
    ],
  };
}

/**
 * resultVariable / resource — bpmn:ScriptTask.
 */
function scriptTaskGroup(element: unknown, injector: any, translate: Translate): Group {
  const modeling = injector.get('modeling');
  return {
    id: 'activitiScriptTask',
    label: translate('Script Task (Activiti)'),
    entries: [
      textEntry('activiti-scriptResultVariable', 'Result Variable', element, 'activiti:resultVariable', modeling, translate),
      textEntry('activiti-scriptResource', 'Resource', element, 'activiti:resource', modeling, translate),
    ],
  };
}

/**
 * formKey / formHandlerClass — bpmn:StartEvent, bpmn:UserTask.
 */
function formGroup(element: unknown, injector: any, translate: Translate): Group {
  const modeling = injector.get('modeling');
  return {
    id: 'activitiForm',
    label: translate('Form (Activiti)'),
    entries: [
      textEntry('activiti-formKey', 'Form Key', element, 'activiti:formKey', modeling, translate),
      textEntry('activiti-formHandlerClass', 'Form Handler Class', element, 'activiti:formHandlerClass', modeling, translate),
    ],
  };
}

/**
 * initiator — bpmn:StartEvent.
 */
function startEventGroup(element: unknown, injector: any, translate: Translate): Group {
  const modeling = injector.get('modeling');
  return {
    id: 'activitiStartEvent',
    label: translate('Start Event (Activiti)'),
    entries: [
      textEntry('activiti-initiator', 'Initiator', element, 'activiti:initiator', modeling, translate),
    ],
  };
}

/**
 * candidateStarterGroups / candidateStarterUsers / historyTimeToLive / versionTag — bpmn:Process.
 */
function processGroup(element: unknown, injector: any, translate: Translate): Group {
  const modeling = injector.get('modeling');
  return {
    id: 'activitiProcess',
    label: translate('Process (Activiti)'),
    entries: [
      textEntry('activiti-candidateStarterGroups', 'Candidate Starter Groups', element, 'activiti:candidateStarterGroups', modeling, translate),
      textEntry('activiti-candidateStarterUsers', 'Candidate Starter Users', element, 'activiti:candidateStarterUsers', modeling, translate),
      textEntry('activiti-historyTimeToLive', 'History Time To Live', element, 'activiti:historyTimeToLive', modeling, translate),
      textEntry('activiti-versionTag', 'Version Tag', element, 'activiti:versionTag', modeling, translate),
    ],
  };
}

/**
 * calledElementBinding / businessKey / inheritVariables — bpmn:CallActivity.
 */
function callActivityGroup(element: unknown, injector: any, translate: Translate): Group {
  const modeling = injector.get('modeling');
  return {
    id: 'activitiCallActivity',
    label: translate('Call Activity (Activiti)'),
    entries: [
      textEntry('activiti-calledElementBinding', 'Called Element Binding', element, 'activiti:calledElementBinding', modeling, translate),
      textEntry('activiti-calledElementVersion', 'Called Element Version', element, 'activiti:calledElementVersion', modeling, translate),
      textEntry('activiti-businessKey', 'Business Key', element, 'activiti:businessKey', modeling, translate),
      checkEntry('activiti-inheritVariables', 'Inherit Variables', element, 'activiti:inheritVariables', modeling, translate),
    ],
  };
}

// ─── Provider constructor ─────────────────────────────────────────────────────

function ActivitiPropertiesProvider(
  this: any,
  propertiesPanel: any,
  injector: any,
  translate: Translate,
) {
  propertiesPanel.registerProvider(this, 400);
  this._injector = injector;
  this._translate = translate;
}

(ActivitiPropertiesProvider as any).$inject = ['propertiesPanel', 'injector', 'translate'];

(ActivitiPropertiesProvider as any).prototype.getGroups = function (element: unknown) {
  const injector: any = this._injector;
  const translate: Translate = this._translate;

  return (groups: Group[]) => {
    // Execution (async/exclusive) – Activities, Gateways, Events
    if (is(element as any, 'bpmn:Activity') || is(element as any, 'bpmn:Gateway') || is(element as any, 'bpmn:Event')) {
      groups.push(executionGroup(element, injector, translate));
    }

    // UserTask-specific
    if (is(element as any, 'bpmn:UserTask')) {
      groups.push(userTaskGroup(element, injector, translate));
    }

    // ServiceTask / BusinessRuleTask / SendTask
    if (
      is(element as any, 'bpmn:ServiceTask') ||
      is(element as any, 'bpmn:BusinessRuleTask') ||
      is(element as any, 'bpmn:SendTask')
    ) {
      groups.push(serviceTaskGroup(element, injector, translate));
    }

    // ScriptTask
    if (is(element as any, 'bpmn:ScriptTask')) {
      groups.push(scriptTaskGroup(element, injector, translate));
    }

    // Form — StartEvent and UserTask
    if (is(element as any, 'bpmn:StartEvent')) {
      groups.push(formGroup(element, injector, translate));
      groups.push(startEventGroup(element, injector, translate));
    }

    // Process
    if (is(element as any, 'bpmn:Process')) {
      groups.push(processGroup(element, injector, translate));
    }

    // CallActivity
    if (is(element as any, 'bpmn:CallActivity')) {
      groups.push(callActivityGroup(element, injector, translate));
    }

    return groups;
  };
};

// ─── Module export ────────────────────────────────────────────────────────────

/** bpmn-js additional module that adds Activiti-specific properties to the panel. */
export const ActivitiPropertiesProviderModule: { [key: string]: unknown } = {
  __init__: ['activitiPropertiesProvider'],
  activitiPropertiesProvider: ['type', ActivitiPropertiesProvider],
};
