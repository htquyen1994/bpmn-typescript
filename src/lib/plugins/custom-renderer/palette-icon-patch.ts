// @ts-ignore – Vite ?raw resolves at build time
import taskIcon              from './palette-icons/task.svg?raw';
// @ts-ignore
import userTaskIcon          from './palette-icons/user-task.svg?raw';
// @ts-ignore
import serviceTaskIcon       from './palette-icons/service-task.svg?raw';
// @ts-ignore
import scriptTaskIcon        from './palette-icons/script-task.svg?raw';
// @ts-ignore
import sendTaskIcon          from './palette-icons/send-task.svg?raw';
// @ts-ignore
import businessRuleIcon      from './palette-icons/business-rule.svg?raw';
// @ts-ignore
import startEventIcon        from './palette-icons/start-event.svg?raw';
// @ts-ignore
import endEventIcon          from './palette-icons/end-event.svg?raw';
// @ts-ignore
import intermediateEventIcon from './palette-icons/intermediate-event.svg?raw';
// @ts-ignore
import gatewayXorIcon        from './palette-icons/gateway-xor.svg?raw';
// @ts-ignore
import gatewayNoneIcon       from './palette-icons/gateway-none.svg?raw';
// @ts-ignore
import gatewayParallelIcon   from './palette-icons/gateway-parallel.svg?raw';
// @ts-ignore
import subprocessIcon        from './palette-icons/subprocess.svg?raw';
// @ts-ignore
import dataObjectIcon        from './palette-icons/data-object.svg?raw';
// @ts-ignore
import dataStoreIcon         from './palette-icons/data-store.svg?raw';
// @ts-ignore
import handToolIcon          from './palette-icons/hand-tool.svg?raw';
// @ts-ignore
import lassoToolIcon         from './palette-icons/lasso-tool.svg?raw';
// @ts-ignore
import spaceToolIcon         from './palette-icons/space-tool.svg?raw';
// @ts-ignore
import connectToolIcon       from './palette-icons/connect-tool.svg?raw';
// @ts-ignore
import taskTypeMoreIcon      from './palette-icons/task-type-more.svg?raw';

/**
 * Maps bpmn-js palette entry CSS class names to custom SVG icon strings.
 * Each key is a class that bpmn-js applies to the palette <div class="entry …">.
 */
const ICON_MAP: Record<string, string> = {
  // Tools
  'bpmn-icon-hand-tool':        handToolIcon      as string,
  'bpmn-icon-lasso-tool':       lassoToolIcon     as string,
  'bpmn-icon-space-tool':       spaceToolIcon     as string,
  'bpmn-icon-connection-multi': connectToolIcon   as string,
  // Tasks
  'bpmn-icon-task':             taskIcon          as string,
  'bpmn-icon-user-task':        userTaskIcon      as string,
  'bpmn-icon-service-task':     serviceTaskIcon   as string,
  'bpmn-icon-script-task':      scriptTaskIcon    as string,
  'bpmn-icon-send-task':        sendTaskIcon      as string,
  'bpmn-icon-receive':          sendTaskIcon      as string, // reuse envelope shape
  'bpmn-icon-business-rule':    businessRuleIcon  as string,
  'bpmn-icon-subprocess-expanded': subprocessIcon as string,
  'bpmn-icon-call-activity':    taskIcon          as string,
  // Events
  'bpmn-icon-start-event-none': startEventIcon        as string,
  'bpmn-icon-end-event-none':   endEventIcon          as string,
  'bpmn-icon-intermediate-event': intermediateEventIcon as string,
  // Gateways
  'bpmn-icon-gateway-none':     gatewayNoneIcon    as string,
  'bpmn-icon-gateway-xor':      gatewayXorIcon     as string,
  'bpmn-icon-gateway-parallel': gatewayParallelIcon as string,
  // Data
  'bpmn-icon-data-object':      dataObjectIcon    as string,
  'bpmn-icon-data-store':       dataStoreIcon     as string,
  // Custom — task type picker
  'csp-palette-task-type-more': taskTypeMoreIcon  as string,
};

interface EventBusService {
  on(event: string, handler: (e: unknown) => void): void;
}

interface CanvasService {
  getContainer(): Element;
}

/**
 * Patches bpmn-js palette entries after render by:
 * 1. Injecting a <span class="csp-palette-icon"> containing a custom SVG.
 * 2. Marking the entry with data-csp-icon so CSS hides the original bpmn-font ::before.
 *
 * Works for both `palette.create` (first paint) and `palette.changed` (rebuilds).
 */
export class PaletteIconPatch {
  static $inject = ['eventBus', 'canvas'];

  constructor(eventBus: EventBusService, canvas: CanvasService) {
    const patch = () => {
      // Defer one tick so bpmn-js has finished writing to the DOM
      setTimeout(() => {
        const root = canvas.getContainer();
        const entries = root.querySelectorAll<HTMLElement>(
          '.djs-palette .entry:not([data-csp-icon])',
        );

        entries.forEach(el => {
          for (const [cls, svg] of Object.entries(ICON_MAP)) {
            if (el.classList.contains(cls)) {
              const span = document.createElement('span');
              span.className = 'csp-palette-icon';
              span.innerHTML = svg;
              el.appendChild(span);
              el.dataset.cspIcon = cls;
              break;
            }
          }
        });
      }, 0);
    };

    eventBus.on('palette.create',  patch);
    eventBus.on('palette.changed', patch);
  }
}
