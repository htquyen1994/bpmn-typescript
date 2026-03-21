// Multi-diagram tab management — public exports

export { TypedEventBus } from './typed-event-bus.js';
export { TabStore }      from './tab-store.js';
export { TabManager }    from './tab-manager.js';

export type {
  // State
  DiagramTabState,
  TabLifecycle,
  ViewboxSnapshot,
  // Config
  AddTabConfig,
  TabManagerConfig,
  // Events
  TabEventMap,
  TabEvent,
  // Hooks
  BeforeActivateHook,
} from './types.js';
