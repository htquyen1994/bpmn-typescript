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

**Same-bundle trick**
The facade detects the currently executing script URL and loads the same bundle inside the iframe `<script type="module">`. This registers `<csp-bpmn-studio>` inside the iframe's custom element registry without needing a separate HTML file.

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

## Build

The library is bundled with [Vite](https://vitejs.dev/) into two formats:

| File | Format | Use |
|------|--------|-----|
| `dist/csp-bpmn.es.js` | ES Module | Modern bundlers (Vite, webpack, Rollup) |
| `dist/csp-bpmn.umd.js` | UMD | Script tag / CommonJS |
| `dist/index.d.ts` | TypeScript declarations | Type checking |

All dependencies (including bpmn-js) are bundled — no peer dependencies required.

```bash
npm run build
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
