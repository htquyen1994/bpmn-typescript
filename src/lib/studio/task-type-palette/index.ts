import { TaskTypePaletteProvider } from './task-type-palette-provider.js';
import { TaskTypePopupProvider }   from './task-type-popup-provider.js';

export const TaskTypePaletteModule: { [key: string]: unknown } = {
  __init__: [
    'taskTypePaletteProvider',
    'taskTypePopupProvider',
  ],
  taskTypePaletteProvider: ['type', TaskTypePaletteProvider],
  taskTypePopupProvider:   ['type', TaskTypePopupProvider],
};
