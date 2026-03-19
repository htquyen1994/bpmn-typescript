import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Ensures temp/studio-bundle.js exists before the dev server or Phase 2 build
 * tries to resolve the ?raw import.
 *
 * - `npm run dev`          → temp/ missing → triggers Phase 1 automatically.
 * - `npm run build:facade` → temp/ was just created by Phase 1 → skips.
 * - `npm run dev` (again)  → temp/ still present from last run → skips.
 */
function runPhase1IfNeeded() {
  const bundlePath = resolve(__dirname, 'temp/studio-bundle.js');
  if (!existsSync(bundlePath)) {
    console.log('\n[csp-bpmn] studio-bundle.js not found — running Phase 1 build…');
    execSync('npm run build:studio', { stdio: 'inherit', cwd: __dirname });
    console.log('[csp-bpmn] Phase 1 complete.\n');
  }
}

/**
 * Ensures temp/studio-bundle.js exists before any module resolution happens.
 *
 * Two hooks are needed because Vite uses different lifecycles for dev vs build:
 *
 * - `configureServer` (dev):   fires before the HTTP server starts accepting
 *   requests, so the file is guaranteed to exist when vite:import-analysis
 *   tries to resolve the ?raw import.
 *
 * - `buildStart` (build/Phase 2): fires before Rollup starts bundling.
 *   At this point Phase 1 has already produced temp/studio-bundle.js, so
 *   this is a safety net (existsSync → skip).
 */
function ensureStudioBundle(): Plugin {
  return {
    name: 'csp-ensure-studio-bundle',
    configureServer() { runPhase1IfNeeded(); },
    buildStart()      { runPhase1IfNeeded(); },
  };
}

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
    ensureStudioBundle(),
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
