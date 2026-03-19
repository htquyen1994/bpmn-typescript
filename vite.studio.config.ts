import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Phase 1 build — compiles <csp-bpmn-studio> into a self-contained IIFE bundle.
 *
 * Output: temp/studio-bundle.js
 *
 * This file is intentionally NOT ESM. See README § "Two-phase build & IIFE" for why.
 */
export default defineConfig({
  build: {
    lib: {
      entry:   resolve(__dirname, 'src/lib/studio/csp-bpmn-studio.ts'),
      formats: ['iife'],
      name:    'CspBpmnStudio',   // global name — unused at runtime, required by Rollup
      fileName: () => 'studio-bundle.js',
    },
    outDir:       'temp',
    emptyOutDir:  true,
    cssCodeSplit: false,
    sourcemap:    false,
    rollupOptions: {
      external: [],   // bundle every dependency (bpmn-js, CSS, etc.)
    },
  },
});
