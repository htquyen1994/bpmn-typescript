// Multi-diagram tab management — public exports

export { TypedEventBus } from './typed-event-bus.js';
export { TabManager }    from './tab-manager.js';

// Store architecture
export { AbstractTabStore }     from './store/abstract-tab-store.js';
export { MemoryTabStore }       from './store/memory-tab-store.js';
export { LocalStorageTabStore } from './store/local-storage-tab-store.js';
export { IndexedDBTabStore }    from './store/indexed-db-tab-store.js';

/** @deprecated Use MemoryTabStore instead. */
export { MemoryTabStore as TabStore } from './store/memory-tab-store.js';

export type {
  // State
  TabMeta,
  DiagramTabState,
  TabLifecycle,
  ViewboxSnapshot,
  TabPatch,
  // Config
  AddTabConfig,
  TabManagerConfig,
  // Events
  TabEventMap,
  TabEvent,
  // Hooks
  BeforeActivateHook,
} from './types.js';
