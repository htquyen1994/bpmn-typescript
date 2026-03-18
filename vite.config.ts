import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

function distPackageJson(): Plugin {
  return {
    name: 'dist-package-json',
    closeBundle() {
      const root = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

      const distPkg = {
        name:        root.name,
        version:     root.version,
        description: root.description,
        type:        root.type,
        main:        'csp-bpmn.umd.js',
        module:      'csp-bpmn.es.js',
        types:       'index.d.ts',
        exports: {
          '.': {
            types:   './index.d.ts',
            import:  './csp-bpmn.es.js',
            require: './csp-bpmn.umd.js',
          },
        },
        // All deps are fully bundled — listed here for transparency only.
        dependencies: root.dependencies,
        sideEffects: false,
      };

      writeFileSync(
        resolve(__dirname, 'dist/package.json'),
        JSON.stringify(distPkg, null, 2) + '\n',
      );

      console.log('✔ dist/package.json written');
    },
  };
}

export default defineConfig({
  plugins: [
    dts({
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/studio/**', 'src/lib/facade/expected-*'],
      rollupTypes: true,
    }),
    distPackageJson(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/index.ts'),
      name: 'CspBpmn',
      formats: ['es', 'umd'],
      fileName: (format) => `csp-bpmn.${format}.js`,
    },
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      // Bundle everything – bpmn-js included.
      external: [],
    },
  },
});
