# csp-bpmn

TypeScript wrapper library around [bpmn-js](https://github.com/bpmn-io/bpmn-js) that bundles the BPMN studio into a self-contained iframe-isolated Web Component. Supports modeler and viewer modes, Camunda/Activiti properties panels, and a Reusable SubProcess system.

---

## Features

- **Zero-config embed** — one `InitBpm()` call injects a fully wired BPMN studio into any container element
- **iframe isolation** — all bpmn-js CSS and DOM are scoped inside an iframe; no style leakage
- **Modeler / Viewer modes** — switch between full edit mode and read-only view
- **Properties panel** — standard BPMN 2.0, Camunda Platform 7, or Activiti/Flowable dialect
- **Diagram grid** — background dot grid via `diagram-js-grid`
- **Reusable SubProcess** — import `.bpmn` files as reusable sub-processes, place them from the palette popup, with full drill-down support
- **XML & SVG export** — save diagram as formatted BPMN 2.0 XML or SVG
- **Full TypeScript types** — everything is typed, including bpmn-js service wrappers

---

## Project Structure

```
src/
├── lib/                          # Library source (published to dist/)
│   ├── index.ts                  # Public API entry point
│   ├── base/
│   │   └── base-component.ts     # Abstract HTMLElement base for Web Components
│   ├── facade/
│   │   └── csp-bpmn-facade.ts    # CSPBpm public facade (iframe orchestration)
│   ├── studio/
│   │   ├── csp-bpmn-studio.ts    # <csp-bpmn-studio> Web Component
│   │   ├── bpmn-modeler-extender.ts  # Typed wrapper around bpmn-js Modeler/Viewer
│   │   ├── activiti-properties-provider.ts  # Activiti/Flowable properties panel
│   │   └── reusable-subprocess/
│   │       ├── index.ts              # didi module export
│   │       ├── subprocess-store.ts   # In-memory store for SubProcess items
│   │       ├── subprocess-creator.ts # XML merge + re-import logic
│   │       ├── subprocess-palette-provider.ts  # Palette entries
│   │       └── subprocess-popup-provider.ts    # Popup menu entries
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types & interfaces
│   └── vendor.d.ts               # Type declarations for untyped packages
└── sample/
    ├── index.html                # Sample app HTML
    └── main.ts                   # Sample app bootstrap & event wiring
```

---

## Installation

```bash
npm install csp-bpmn
```

Or with the source:

```bash
npm install
npm run dev      # start sample dev server
npm run build    # build library to dist/
```

---

## Quick Start

```typescript
import { CSPBpm } from 'csp-bpmn';

const bpm = await CSPBpm.InitBpm({
  container: document.getElementById('diagram-container')!,
  mode: 'modeler',
});

await bpm.importXML(myBpmnXml);
```

The `container` element should have a defined width and height (e.g. `flex: 1` or explicit `height: 600px`).

---

## API Reference

### `CSPBpm.InitBpm(config)`

Static factory. Creates and mounts the studio, returns a `CSPBpm` instance.

```typescript
const bpm = await CSPBpm.InitBpm(config: CSPBpmConfig): Promise<CSPBpm>
```

#### `CSPBpmConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `container` | `HTMLElement` | Yes | DOM element the iframe is appended to |
| `mode` | `'modeler' \| 'viewer'` | Yes | Edit or read-only mode |
| `provider` | `'bpmn' \| 'camunda' \| 'activiti'` | No | Properties panel dialect (default: `'bpmn'`) |
| `onReady` | `(instance) => void` | No | Called once the studio is fully initialized |

---

### Diagram Operations

```typescript
// Import a BPMN 2.0 XML string
await bpm.importXML(xml: string): Promise<void>

// Export current diagram as formatted BPMN 2.0 XML
const xml = await bpm.saveXML(): Promise<string | undefined>

// Export current diagram as SVG
const svg = await bpm.saveSVG(): Promise<string | undefined>
```

---

### Mode

```typescript
// Switch between modeler and viewer at runtime
bpm.setMode(mode: 'modeler' | 'viewer'): void
```

---

### Events

```typescript
// Subscribe to a BPMN event
const unsubscribe = bpm.on(event: BpmnEventType, callback: BpmnEventCallback): () => void

// Unsubscribe
bpm.off(event: BpmnEventType, callback: BpmnEventCallback): void
```

#### Supported Events (`BpmnEventType`)

| Event | Description |
|-------|-------------|
| `element.click` | User clicks an element on the canvas |
| `element.dblclick` | User double-clicks an element |
| `selection.changed` | Selection changes |
| `commandStack.changed` | Any edit operation (undo-able action) |
| `import.done` | XML import completed |

---

### Zoom

```typescript
bpm.zoomIn(): void       // zoom in by 10%
bpm.zoomOut(): void      // zoom out by 10%
bpm.zoomFit(): void      // fit diagram to viewport
bpm.zoomReset(): void    // reset to 1:1
```

---

### Undo / Redo

```typescript
bpm.undo(): void
bpm.redo(): void
```

---

### Element Access

```typescript
// Get a BPMN element by its ID
const el = bpm.getElement(elementId: string): BpmnElement | null
```

#### `BpmnElement`

```typescript
interface BpmnElement {
  id: string;
  type: string;
  name?: string;
  parent?: { id: string };
  businessObject?: Record<string, unknown>;
}
```

---

### Lifecycle

```typescript
// Remove the iframe and release resources
bpm.destroy(): void
```

---

## Provider Modes

The `provider` option controls the properties panel and moddle extensions loaded.

| Value | Use case |
|-------|----------|
| `'bpmn'` | Standard BPMN 2.0 only (default) |
| `'camunda'` | Camunda Platform 7 — exposes Camunda extension attributes |
| `'activiti'` | Activiti / Flowable Java back-end — exposes `activiti:assignee`, `activiti:candidateGroups`, `activiti:async`, `activiti:class`, `activiti:expression`, form fields, etc. |

```typescript
const bpm = await CSPBpm.InitBpm({
  container,
  mode: 'modeler',
  provider: 'activiti',   // or 'camunda' or 'bpmn'
});
```

---

## Reusable SubProcess

The modeler includes a built-in system for defining and reusing sub-processes across diagrams.

### How it works

1. Click **Import SubProcess XML** in the palette (upload icon) or the toolbar **⊕ Import XML** button
2. Pick a `.bpmn` or `.xml` file — its process is stored in memory
3. Click **Place Reusable SubProcess** in the palette to open the popup menu
4. Select a stored sub-process to insert it into the current diagram as a collapsed sub-process
5. Double-clicking the placed element opens the inner diagram (drill-down)

### Internal events

| Event | Fired by | Handled by |
|-------|----------|------------|
| `subprocess.import-request` | Palette / popup "Import XML…" entry | Studio — opens file picker |
| `subprocess.create` | Popup menu item click | Studio — merges XML and re-imports |
| `subprocess.store.changed` | SubprocessStore on add/remove | (available for custom listeners) |

---

## Architecture

```
Host page
└── CSPBpm (facade)
    └── <iframe> (CSS / DOM isolation)
        └── <csp-bpmn-studio> (Web Component)
            ├── Toolbar (SubProcess import button)
            ├── bpmn-js Modeler or NavigatedViewer
            │   ├── BpmnPropertiesPanelModule
            │   ├── GridModule
            │   └── ReusableSubprocessModule
            │       ├── SubprocessStore       (IoC service)
            │       ├── SubprocessPaletteProvider
            │       ├── SubprocessPopupProvider
            │       └── SubprocessCreator
            └── Properties Panel container
```

**Why iframe isolation?**
bpmn-js injects several global CSS stylesheets. Without isolation these override the host application's styles. The iframe ensures bpmn-js styles are fully contained.

**Two-phase build & self-contained iframe**
See [§ Two-phase build](#two-phase-build) below for a full explanation of how the studio is embedded without requiring any URL or server file.

---

## TypeScript Types

All public types are exported from the package root:

```typescript
import type {
  CSPBpmConfig,
  BpmStudioMode,
  BpmnProvider,
  BpmnElement,
  BpmnEventType,
  BpmnEventCallback,
  BpmnCanvas,
  BpmnViewbox,
  BpmnEventBus,
  BpmnCommandStack,
  BpmnElementRegistry,
  SubprocessItem,
  ExportXmlResult,
  ExportSvgResult,
} from 'csp-bpmn';
```

---

## Two-phase build

### The problem with a single bundle

The `CSPBpm` facade loads the studio inside an `<iframe>` for CSS/DOM isolation. The iframe needs a complete HTML document that registers the `<csp-bpmn-studio>` custom element. The naive approach is to detect the currently executing script URL at runtime and inject it as `<script src="...">` into a Blob HTML document. This breaks the moment the library is consumed through a modern bundler (Vite, webpack, Rollup), because the bundler re-packages the code — the original script URL no longer exists at the path the library expects, or is not a `<script src>` tag at all.

### Solution: inline the studio bundle as a string

The build is split into two sequential phases:

```
Phase 1  vite.studio.config.ts
         src/lib/studio/csp-bpmn-studio.ts
         → temp/studio-bundle.js   (IIFE, all deps bundled, ~3 MB minified)

Phase 2  vite.config.ts
         src/lib/index.ts  (facade + public API)
         reads temp/studio-bundle.js via ?raw import → string literal embedded inside
         → dist/csp-bpmn.es.js
         → dist/csp-bpmn.umd.js
         temp/ deleted after build
```

At runtime, `createStudioFrameURL()` in the facade builds an HTML string that contains the entire studio bundle as an **inline `<script>`**, then turns it into a Blob URL:

```typescript
// studioBundle is a string constant baked into the final dist file by Vite's ?raw import.
const content = `<!DOCTYPE html><html>
  <head>
    <script>${safeBundle}<\/script>
  </head>
  <body><csp-bpmn-studio></csp-bpmn-studio></body>
</html>`;
return URL.createObjectURL(new Blob([content], { type: 'text/html' }));
```

There is no URL to manage, no server file to deploy, and no runtime environment dependency.

---

### Why IIFE and not ESM for Phase 1?

| | ESM (`type="module"`) | IIFE |
|---|---|---|
| Inline `<script>` support | **No** — `import` statements are forbidden inside inline scripts by the HTML spec | **Yes** — self-executing function, no imports |
| External `<script src="blob:...">` | Works, but adds an extra Blob URL lifecycle to manage | Not needed |
| `customElements.define` timing | Deferred (modules are always async) — the `<csp-bpmn-studio>` tag might upgrade after the element is parsed | Synchronous — element is registered before `<body>` is parsed |
| Tree-shaking | Available | Not needed (we bundle everything intentionally) |
| Requires `type="module"` attribute | Yes | No |

**Key constraint — inline scripts cannot use `import`:**

The HTML spec states that `<script type="module">` blocks may only appear as external scripts (with `src`) or as inline scripts *without* `import` statements. A compiled ESM bundle still contains `import` at the top of the file, which is illegal inside an inline `<script>`. The browser will refuse to execute it.

An IIFE bundle wraps everything in:

```js
var CspBpmnStudio = (function () {
  /* bpmn-js + studio code — no import statements */
  customElements.define('csp-bpmn-studio', CspBpmnStudioElement);
  return { CspBpmnStudioElement };
})();
```

This is a plain classic script that browsers have supported since the beginning. It runs **synchronously** as soon as the `<script>` tag is encountered, so the custom element is registered before the HTML parser reaches `<csp-bpmn-studio>` in `<body>`.

**`</script>` injection guard:**

If the studio bundle contains the literal string `</script>` (e.g. inside a minified string constant), the HTML parser would prematurely close the `<script>` tag. The facade escapes this at build time:

```typescript
const safeBundle = studioBundle.replace(/<\/script>/gi, '<\\/script>');
```

In JavaScript, `<\/script>` and `</script>` are identical at runtime — the backslash is a no-op escape — but the HTML parser never sees the closing sequence.

---

## Build

The library is bundled with [Vite](https://vitejs.dev/) into two formats:

| File | Format | Use |
|------|--------|-----|
| `dist/csp-bpmn.es.js` | ES Module | Modern bundlers (Vite, webpack, Rollup) |
| `dist/csp-bpmn.umd.js` | UMD | Script tag / CommonJS |
| `dist/index.d.ts` | TypeScript declarations | Type checking |

All dependencies (including bpmn-js) are bundled — no peer dependencies required.

```bash
# Full 2-phase build (Phase 1 → temp/, Phase 2 → dist/, temp/ deleted)
npm run build

# Run phases individually (useful for debugging)
npm run build:studio   # Phase 1 only → temp/studio-bundle.js
npm run build:facade   # Phase 2 only → dist/  (requires temp/ from Phase 1)
```

---

## Development

```bash
npm run dev
```

Opens the sample app at `http://localhost:5173`. The sample demonstrates all features: import, export, download, open file, zoom, undo/redo, events log, and the reusable subprocess workflow.

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `bpmn-js` | ^17 | Core BPMN 2.0 modeler and viewer |
| `bpmn-js-properties-panel` | ^5 | Properties panel (BPMN + Camunda) |
| `@bpmn-io/properties-panel` | ^3 | Properties panel base UI |
| `activiti-bpmn-moddle` | ^4 | Activiti moddle extension |
| `diagram-js-grid` | ^2 | Background dot grid |

---

## License

MIT
