import { CSPBpm } from '../lib/index.js';
import type { SelectOption } from '../lib/index.js';

// ── Simulated async user list (mimics an API call) ────────────────────────────
const fetchAssignees = (): Promise<SelectOption[]> =>
  new Promise(resolve =>
    setTimeout(() => resolve([
      { value: 'alice',   label: 'Alice Johnson — Engineering' },
      { value: 'bob',     label: 'Bob Smith — QA'              },
      { value: 'carol',   label: 'Carol Williams — Product'    },
      { value: 'david',   label: 'David Lee — DevOps'          },
      { value: 'eve',     label: 'Eve Martinez — Security'     },
    ]), 500),
  );

// ── Static option lists ───────────────────────────────────────────────────────
const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'low',      label: 'Low'      },
  { value: 'medium',   label: 'Medium'   },
  { value: 'high',     label: 'High'     },
  { value: 'critical', label: 'Critical' },
];

const SERVICE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'rest',  label: 'REST API'        },
  { value: 'grpc',  label: 'gRPC'            },
  { value: 'kafka', label: 'Kafka Consumer'  },
  { value: 'db',    label: 'Database Query'  },
];

// ── Sample BPMN with UserTask + ServiceTask elements ─────────────────────────
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  targetNamespace="http://bpmn.io/schema/bpmn">

  <bpmn:process id="leave-approval" name="Leave Approval" isExecutable="true">
    <bpmn:startEvent id="Start" name="Request Submitted">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>

    <bpmn:userTask id="Task_Review" name="Review Request">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:userTask id="Task_Approve" name="Approve Request">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:serviceTask id="Task_Notify" name="Send Notification">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:endEvent id="End" name="Process Complete">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>

    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start"       targetRef="Task_Review"  />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Review" targetRef="Task_Approve" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_Approve" targetRef="Task_Notify" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_Notify" targetRef="End"         />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="leave-approval">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start">
        <dc:Bounds x="152" y="242" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="126" y="285" width="88" height="27" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Review_di" bpmnElement="Task_Review">
        <dc:Bounds x="240" y="220" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Approve_di" bpmnElement="Task_Approve">
        <dc:Bounds x="400" y="220" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Notify_di" bpmnElement="Task_Notify">
        <dc:Bounds x="560" y="220" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_di" bpmnElement="End">
        <dc:Bounds x="722" y="242" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="696" y="285" width="88" height="27" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="260" /><di:waypoint x="240" y="260" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="340" y="260" /><di:waypoint x="400" y="260" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="500" y="260" /><di:waypoint x="560" y="260" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="660" y="260" /><di:waypoint x="722" y="260" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const container      = document.getElementById('diagram-container')!;
const panelContainer = document.getElementById('custom-panel-container')!;
const output         = document.getElementById('output')!;

function log(msg: string): void {
  const ts = new Date().toLocaleTimeString();
  output.textContent += `[${ts}] ${msg}\n`;
  output.scrollTop = output.scrollHeight;
}

log('Initializing studio…');

CSPBpm.InitBpm({ container, mode: 'modeler' }).then(async (bpm) => {
  log('Studio ready.');

  // ── 1. Mount the custom panel ────────────────────────────────────────────
  bpm.mountCustomPanel(panelContainer);

  // ── 2. Register properties for bpmn:UserTask (all UserTasks in the diagram)
  bpm.addCustomPropertyForType('bpmn:UserTask', [
    {
      key:         'assignee',
      label:       'Assignee',
      type:        'selection',
      description: 'Person responsible for this task (loaded from API).',
      options:     fetchAssignees,          // async — shows "Loading…" briefly
      validation:  { required: true },
      onChange:    (v, id) => log(`[${id}] assignee → ${v}`),
    },
    {
      key:         'priority',
      label:       'Priority',
      type:        'selection',
      options:     PRIORITY_OPTIONS,        // static list
      defaultValue: 'medium',
      onChange:    (v, id) => log(`[${id}] priority → ${v}`),
    },
    {
      key:         'dueInDays',
      label:       'Due (days)',
      type:        'text',
      placeholder: 'e.g. 3',
      description: 'Number of business days to complete.',
      validation:  { pattern: /^\d+$/, min: 1, max: 365 },
      onChange:    (v, id) => log(`[${id}] dueInDays → ${v}`),
    },
    {
      key:         'notes',
      label:       'Notes',
      type:        'text',
      multiline:   true,
      placeholder: 'Optional instructions…',
    },
    {
      key:         'isUrgent',
      label:       'Mark as urgent',
      type:        'checkbox',
      defaultValue: false,
      onChange:    (v, id) => log(`[${id}] isUrgent → ${v}`),
    },
  ]);

  // ── 3. Register different properties for bpmn:ServiceTask ────────────────
  bpm.addCustomPropertyForType('bpmn:ServiceTask', [
    {
      key:        'serviceType',
      label:      'Service Type',
      type:       'selection',
      options:    SERVICE_TYPE_OPTIONS,
      validation: { required: true },
      onChange:   (v, id) => log(`[${id}] serviceType → ${v}`),
    },
    {
      key:         'endpoint',
      label:       'Endpoint / Topic',
      type:        'text',
      placeholder: 'https://api.example.com/notify',
      description: 'URL, gRPC method, or Kafka topic.',
      validation:  {
        required:  true,
        minLength: 3,
        maxLength: 256,
      },
      onChange: (v, id) => log(`[${id}] endpoint → ${v}`),
    },
    {
      key:         'retryCount',
      label:       'Max Retries',
      type:        'text',
      placeholder: '3',
      validation:  { pattern: /^\d+$/, min: 0, max: 10 },
    },
    {
      key:         'async',
      label:       'Execute asynchronously',
      type:        'checkbox',
      defaultValue: false,
    },
  ]);

  // ── 4. Override a specific element with an extra property ─────────────────
  bpm.addCustomProperty('Task_Review', {
    key:         'reviewChecklist',
    label:       'Checklist URL',
    type:        'text',
    placeholder: 'https://wiki.example.com/checklist',
    description: 'Link to the review checklist (Task_Review only).',
  });

  // ── 5. Wire toolbar buttons ───────────────────────────────────────────────
  document.getElementById('btn-validate')!.addEventListener('click', () => {
    const valid = bpm.validateCustomProperties();
    log(valid ? '✓ All properties valid.' : '✗ Validation failed — check highlighted fields.');
  });

  document.getElementById('btn-get-values')!.addEventListener('click', () => {
    bpm.on('selection.changed', (e: any) => {
      const el = e?.newSelection?.[0];
      if (!el) return;
      const vals = bpm.getCustomValues(el.id);
      log(`Values for ${el.id}: ${JSON.stringify(vals, null, 2)}`);
    });
    // Also log current selection immediately if available
    log('(Click "Get Values" then click an element to see its values)');
  });

  bpm.on('element.click', (e: any) => {
    const el = e.element;
    if (!el || el.type === 'bpmn:SequenceFlow') return;
    const vals = bpm.getCustomValues(el.id);
    const hasValues = Object.keys(vals).length > 0;
    log(`Selected: ${el.type} "${el.businessObject?.name ?? el.id}"` +
      (hasValues ? ` | stored: ${JSON.stringify(vals)}` : ''));
  });

  document.getElementById('btn-zoom-fit')!.addEventListener('click',  () => bpm.zoomFit());
  document.getElementById('btn-zoom-in')!.addEventListener('click',   () => bpm.zoomIn());
  document.getElementById('btn-zoom-out')!.addEventListener('click',  () => bpm.zoomOut());
  document.getElementById('btn-undo')!.addEventListener('click',      () => bpm.undo());
  document.getElementById('btn-redo')!.addEventListener('click',      () => bpm.redo());

  // ── 6. Load diagram ───────────────────────────────────────────────────────
  await bpm.importXML(SAMPLE_XML);
  log('Diagram loaded. Click a User Task or Service Task to edit its properties.');

}).catch(err => {
  log(`Init error: ${err}`);
  console.error(err);
});
