/**
 * @deprecated
 * TabStore has been replaced by a pluggable store architecture.
 * Use `MemoryTabStore` (drop-in equivalent) or any other `AbstractTabStore`
 * implementation from `'./store/index.js'`.
 *
 * @example
 * // Before
 * import { TabStore } from './tab-store.js';
 *
 * // After
 * import { MemoryTabStore } from './store/index.js';
 */
export { MemoryTabStore as TabStore } from './store/index.js';
export type { TabPatch } from './types.js';
