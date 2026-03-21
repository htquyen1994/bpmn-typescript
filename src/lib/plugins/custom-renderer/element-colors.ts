export interface ElementColors {
  fill:   string;
  stroke: string;
}

const DEFAULT: ElementColors = { fill: '#f8fafc', stroke: '#64748b' };

// ── Activities (tasks, subprocesses, call activities) ────────────────────────

const ACTIVITY_COLORS: Record<string, ElementColors> = {
  'bpmn:UserTask':         { fill: '#dbeafe', stroke: '#3b82f6' }, // blue
  'bpmn:ServiceTask':      { fill: '#ede9fe', stroke: '#7c3aed' }, // violet
  'bpmn:ScriptTask':       { fill: '#ffedd5', stroke: '#ea580c' }, // orange
  'bpmn:BusinessRuleTask': { fill: '#fce7f3', stroke: '#db2777' }, // pink
  'bpmn:SendTask':         { fill: '#d1fae5', stroke: '#059669' }, // emerald
  'bpmn:ReceiveTask':      { fill: '#dcfce7', stroke: '#16a34a' }, // green
  'bpmn:ManualTask':       { fill: '#fef9c3', stroke: '#ca8a04' }, // amber
  'bpmn:CallActivity':     { fill: '#e0f2fe', stroke: '#0284c7' }, // sky
  'bpmn:SubProcess':       { fill: '#f0fdf4', stroke: '#15803d' }, // green-700
  'bpmn:Task':             { fill: '#f8fafc', stroke: '#64748b' }, // slate (generic)
};

// ── Events ───────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, ElementColors> = {
  'bpmn:StartEvent':             { fill: '#d1fae5', stroke: '#16a34a' }, // emerald
  'bpmn:EndEvent':               { fill: '#fee2e2', stroke: '#dc2626' }, // red
  'bpmn:IntermediateCatchEvent': { fill: '#fef9c3', stroke: '#ca8a04' }, // amber
  'bpmn:IntermediateThrowEvent': { fill: '#fde68a', stroke: '#d97706' }, // amber-dark
  'bpmn:BoundaryEvent':          { fill: '#fef9c3', stroke: '#ca8a04' }, // amber
};

// ── Gateways ─────────────────────────────────────────────────────────────────

const GATEWAY_COLORS: Record<string, ElementColors> = {
  'bpmn:ExclusiveGateway':  { fill: '#fee2e2', stroke: '#dc2626' }, // red
  'bpmn:ParallelGateway':   { fill: '#d1fae5', stroke: '#16a34a' }, // green
  'bpmn:InclusiveGateway':  { fill: '#fef9c3', stroke: '#ca8a04' }, // amber
  'bpmn:EventBasedGateway': { fill: '#ede9fe', stroke: '#7c3aed' }, // violet
  'bpmn:ComplexGateway':    { fill: '#fce7f3', stroke: '#db2777' }, // pink
};

export function getActivityColors(type: string): ElementColors {
  return ACTIVITY_COLORS[type] ?? DEFAULT;
}

export function getEventColors(type: string): ElementColors {
  return EVENT_COLORS[type] ?? DEFAULT;
}

export function getGatewayColors(type: string): ElementColors {
  return GATEWAY_COLORS[type] ?? DEFAULT;
}
