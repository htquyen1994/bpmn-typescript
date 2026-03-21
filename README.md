# csp-bpmn

TypeScript wrapper library around [bpmn-js](https://github.com/bpmn-io/bpmn-js) that bundles the BPMN studio into a self-contained iframe-isolated Web Component. Supports modeler and viewer modes, Camunda/Activiti properties panels, multi-diagram tab management, and a Reusable SubProcess system.

---

## Features

- **Zero-config embed** — one `InitBpm()` call injects a fully wired BPMN studio into any container element
- **iframe isolation** — all bpmn-js CSS and DOM are scoped inside an iframe; no style leakage
- **Modeler / Viewer modes** — switch between full edit mode and read-only view
- **Properties panel** — standard BPMN 2.0, Camunda Platform 7, or Activiti/Flowable dialect
- **Diagram grid** — background dot grid via `diagram-js-grid`
- **Multi-diagram tab bar** — Excel-like tab bar: open, close, rename, switch between multiple diagrams simultaneously
- **Custom Properties Panel** — attach arbitrary form fields to any BPMN element; values persisted to `bpmn:extensionElements`
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
│   ├── multi/                    # Multi-tab state management (zero dependencies)
│   │   ├── index.ts              # Barrel exports
│   │   ├── types.ts              # DiagramTabState, TabEventMap, ViewboxSnapshot …
│   │   ├── typed-event-bus.ts    # Generic type-safe Observer/EventEmitter
│   │   ├── tab-store.ts          # Repository — CRUD + ordering for tab objects
│   │   └── tab-manager.ts        # Mediator — orchestrates store + events + hooks
│   ├── studio/
│   │   ├── csp-bpmn-studio.ts    # <csp-bpmn-studio> Web Component
│   │   ├── bpmn-modeler-extender.ts  # Typed wrapper around bpmn-js Modeler/Viewer
│   │   ├── activiti-properties-provider.ts
│   │   ├── tab-bar/
│   │   │   ├── tab-bar-ui.ts         # DOM renderer for the Excel-like tab bar
│   │   │   ├── tab-bar-styles.ts     # Scoped CSS string for tab bar
│   │   │   └── index.ts
│   │   ├── custom-properties/
│   │   │   ├── custom-properties-provider.ts  # bpmn-js service; renders panel inside iframe
│   │   │   └── index.ts
│   │   ├── task-type-palette/    # "⋯ More task types" palette + popup
│   │   └── reusable-subprocess/
│   │       ├── subprocess-store.ts
│   │       ├── subprocess-creator.ts
│   │       ├── subprocess-palette-provider.ts
│   │       └── subprocess-popup-provider.ts
│   ├── custom-panel/             # Standalone custom-properties panel (host-page DOM)
│   ├── types/
│   │   └── index.ts
│   └── vendor.d.ts
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
└── CSPBpm (Facade)
    └── <iframe> (CSS / DOM isolation)
        └── <csp-bpmn-studio> (Web Component)
            ├── Toolbar (SubProcess import)
            ├── Main area (flex row)
            │   ├── bpmn-js Modeler (single shared instance)
            │   │   ├── BpmnPropertiesPanelModule
            │   │   ├── GridModule
            │   │   ├── TaskTypePaletteModule     (⋯ more task types)
            │   │   ├── CustomPropertiesModule    (renders inside iframe)
            │   │   └── ReusableSubprocessModule
            │   │       ├── SubprocessStore       (IoC service)
            │   │       ├── SubprocessPaletteProvider
            │   │       ├── SubprocessPopupProvider
            │   │       └── SubprocessCreator
            │   └── Right panel
            │       ├── Properties Panel container
            │       ├── [Toggle] Custom Properties
            │       └── Custom Panel body
            ├── Tab Bar (bottom)                 ← TabBarUI (DOM renderer)
            │   ├── Scrollable tab list          ← subscribes to TabManager events
            │   └── [+] Add tab button
            └── State management (src/lib/multi/)
                ├── TabManager  (Mediator)        ← owns store + event bus
                ├── TabStore    (Repository)       ← CRUD + ordering
                └── TypedEventBus (Observer)       ← typed pub/sub
```

**One modeler, many tabs:**
The multi-tab effect uses a single bpmn-js instance. On each tab switch, the current diagram XML + viewport are captured, then the next tab's XML is imported and its viewport restored. Undo/redo history is session-scoped (not persisted across tab switches; content is always preserved).

**Why iframe isolation?**
bpmn-js injects several global CSS stylesheets. Without isolation these override the host application's styles. The iframe ensures bpmn-js styles are fully contained.

**Two-phase build & self-contained iframe**
See [§ Two-phase build](#two-phase-build) below for a full explanation of how the studio is embedded without requiring any URL or server file.

**Custom Properties Panel**
Renders inside the studio iframe — values are written to `bpmn:extensionElements → activiti:Properties` via `modeling.updateProperties()` so they are undo/redo aware and included in `saveXML()` output.

---

---

## Custom Properties Panel

A generic, extensible panel for attaching arbitrary form fields to any BPMN element. Renders in the **host page DOM** (not inside the iframe) so it can be styled freely.

### Quick start

```typescript
const bpm = await CSPBpm.InitBpm({ container, mode: 'modeler' });

// 1. Mount the panel into any element in your page
bpm.mountCustomPanel(document.getElementById('my-panel')!);

// 2. Register properties for a BPMN type
bpm.addCustomPropertyForType('bpmn:UserTask', [
  {
    key:        'assignee',
    label:      'Assignee',
    type:       'selection',
    options:    () => fetch('/api/users').then(r => r.json()), // async OK
    validation: { required: true },
  },
  {
    key:         'priority',
    label:       'Priority',
    type:        'selection',
    options:     [
      { value: 'low',    label: 'Low'    },
      { value: 'medium', label: 'Medium' },
      { value: 'high',   label: 'High'   },
    ],
    defaultValue: 'medium',
  },
  { key: 'notes',    label: 'Notes',        type: 'text', multiline: true },
  { key: 'isUrgent', label: 'Mark urgent',  type: 'checkbox' },
]);

// 3. Register for a specific element ID
bpm.addCustomProperty('Task_Review', {
  key: 'checklist', label: 'Checklist URL', type: 'text',
});

// 4. Read values at any time
bpm.on('element.click', (e) => {
  console.log(bpm.getCustomValues(e.element.id));
});

// 5. Programmatic validation
const isValid = bpm.validateCustomProperties();
```

### Facade API

| Method | Description |
|--------|-------------|
| `mountCustomPanel(container)` | Attach the panel to a DOM element and start listening for selection changes. |
| `addCustomProperty(target, config)` | Register one or more properties. `target` is an element ID string, `{ elementId }`, or `{ bpmnType }`. |
| `addCustomPropertyForType(bpmnType, config)` | Shorthand for `addCustomProperty({ bpmnType }, config)`. |
| `getCustomValues(elementId)` | Return all stored values for an element as `Record<string, unknown>`. |
| `setCustomValues(elementId, values)` | Pre-populate values programmatically. |
| `validateCustomProperties()` | Run all validators for the selected element; returns `true` if valid. |

### Property types

| `type` | Input rendered | Extra config |
|--------|---------------|--------------|
| `'text'` | `<input>` or `<textarea>` | `placeholder`, `multiline` |
| `'checkbox'` | `<input type="checkbox">` | — |
| `'selection'` | `<select>` with optional loading state | `options: SelectOption[] \| () => … \| async () => …`, `placeholder` |

### Validation rules (`ValidationRule`)

| Rule | Type | Description |
|------|------|-------------|
| `required` | `boolean` | Non-empty value required. |
| `pattern` | `RegExp \| string` | Value must match regex. |
| `min` / `max` | `number` | Numeric bounds (parses string values). |
| `minLength` / `maxLength` | `number` | String length bounds. |
| `custom` | `(value) => string \| null` | Arbitrary rule — return an error message or `null`. |

Errors are shown inline below the field on blur. A full validation sweep (all fields at once) is triggered by `validateCustomProperties()`.

### Design patterns used

**Strategy pattern — Validation:**
`ValidationEngine` composes multiple `IValidationStrategy` objects. Each strategy handles one rule type (`RequiredStrategy`, `PatternStrategy`, `MinMaxStrategy`, `LengthStrategy`, `CustomStrategy`). Add project-specific strategies with `engine.addStrategy(myStrategy)`.

**Factory pattern — Renderers:**
`PropertyRendererFactory` is a static registry mapping type strings to `IPropertyRenderer` implementations. Built-in renderers are registered at import time. Register custom types with:
```typescript
import { PropertyRendererFactory } from '@csp-bpmn-studio/core';

PropertyRendererFactory.register('date-picker', new MyDatePickerRenderer());
```

**Facade pattern — API surface:**
`CSPBpm` exposes the four-method surface (`mountCustomPanel`, `addCustomProperty`, `getCustomValues`, `validateCustomProperties`) while hiding the `CustomPropertiesPanel`, `ValidationEngine`, and renderer wiring.

### Module structure

```
src/lib/custom-panel/
├── types.ts                     # All type definitions (discriminated union)
├── validation.ts                # IValidationStrategy + ValidationEngine
├── panel-styles.ts              # CSS injected once into document.head
├── custom-properties-panel.ts   # Core panel class
├── renderers/
│   ├── factory.ts               # IPropertyRenderer + PropertyRendererFactory
│   ├── text.ts
│   ├── checkbox.ts
│   └── selection.ts             # Handles sync / async OptionsSource
└── index.ts                     # Registers built-in renderers + re-exports
```

### Sample demo

```bash
npm run dev
# Open http://localhost:5173/custom-panel.html
```

The demo shows a Leave Approval process with `UserTask` and `ServiceTask` elements. Clicking either type shows type-specific custom properties. The `Assignee` field simulates a 500 ms async API call.

---

---

## Multi-Diagram Tab Management

Quản lý nhiều diagram song song như Excel — mỗi tab là một diagram độc lập với trạng thái, tiêu đề, và lịch sử unsaved riêng.

### Giao diện

```
┌──────────────────────────────────────────────────────────┐
│  Toolbar (SubProcess import)                             │
├──────────────────────────────────────────────────────────┤
│                                     │                    │
│   bpmn-js canvas                    │  Properties panel  │
│   (active diagram)                  │  Custom properties │
│                                     │                    │
├──────────────────────────────────────────────────────────┤
│ ● Diagram 1 × │ Diagram 2 × │ Order Process × │  +      │
└──────────────────────────────────────────────────────────┘
   Tab bar (bottom) — ● = dirty (unsaved changes)
```

- **Click tab** → switch active diagram (current state is auto-saved)
- **Double-click tab label** → inline rename
- **× button** → close tab (last tab auto-replaced with blank)
- **+ button** → open a new blank diagram tab
- **Amber dot (●)** → unsaved changes present (`isDirty = true`)

---

### Quick Start — multi-tab

```typescript
import { CSPBpm } from 'csp-bpmn';

const bpm = await CSPBpm.InitBpm({
  container: document.getElementById('diagram-container')!,
  mode: 'modeler',
});

// The first blank tab is created automatically.

// ① Add more tabs
const tab1 = await bpm.addTab({ title: 'Order Process', xml: orderXml });
const tab2 = await bpm.addTab({ title: 'Invoice Flow' });

// ② Switch to a tab
await bpm.activateTab(tab1.id);

// ③ Close a tab (switches to nearest sibling automatically)
await bpm.closeTab(tab2.id);

// ④ List all open tabs
const tabs = bpm.getAllTabs();
console.log(tabs.map(t => `[${t.id}] "${t.title}" dirty=${t.isDirty}`));

// ⑤ Get the currently active tab id
const activeId = bpm.getActiveTabId();

// ⑥ Copy current diagram → paste into a new tab (cross-tab duplication)
await bpm.copyActiveTabToClipboard();
const clonedTab = await bpm.pasteFromClipboard();
```

---

### Tab Facade API

| Method | Signature | Description |
|--------|-----------|-------------|
| `addTab` | `(config?) => Promise<DiagramTabState>` | Create and switch to a new tab |
| `activateTab` | `(id) => Promise<boolean>` | Switch to an existing tab by id |
| `closeTab` | `(id) => Promise<void>` | Close a tab; opens blank if last |
| `getActiveTabId` | `() => string \| null` | ID of the currently shown tab |
| `getAllTabs` | `() => DiagramTabState[]` | All tabs in display order |
| `copyActiveTabToClipboard` | `() => Promise<string \| null>` | Snapshot current diagram XML to internal clipboard |
| `pasteFromClipboard` | `() => Promise<DiagramTabState \| null>` | Open a new tab with clipboard XML |

---

### `AddTabConfig`

```typescript
interface AddTabConfig {
  /** Display name. Defaults to "Diagram N". */
  title?:    string;
  /** Initial BPMN 2.0 XML. Defaults to a blank diagram with one StartEvent. */
  xml?:      string;
  /** Saved viewport (zoom + scroll). Defaults to fit-viewport on first open. */
  viewbox?:  ViewboxSnapshot;
  /** Arbitrary key-value metadata attached to the tab object. */
  metadata?: Record<string, unknown>;
}
```

---

### `DiagramTabState`

```typescript
interface DiagramTabState {
  readonly id:        string;         // unique tab id, never changes
  readonly index:     number;         // creation-order sequence number
  title:              string;         // current display label
  isDirty:            boolean;        // true = unsaved changes present
  lifecycle:          TabLifecycle;   // 'idle' | 'loading' | 'ready' | 'error'
  xml:                string;         // last-snapshotted BPMN XML
  viewbox:            ViewboxSnapshot | null;  // last-saved viewport
  readonly createdAt: number;         // Unix ms
  metadata:           Record<string, unknown>;
}
```

`isDirty` is set to `true` automatically when `commandStack.changed` fires (any user edit). It is cleared when `saveXML()` is called or when you call `importXML()` to load a specific diagram.

---

### Tab Events (`TabEventMap`)

The underlying `TabManager` emits typed events you can subscribe to directly if you use the lower-level API:

```typescript
import { TabManager } from 'csp-bpmn';

const manager = new TabManager();

// tab.added — a new tab was registered
manager.events.on('tab.added', ({ tab }) => {
  console.log('New tab:', tab.title);
});

// tab.activated — a tab switch completed
manager.events.on('tab.activated', ({ prev, next }) => {
  console.log(`Switched from "${prev?.title}" to "${next.title}"`);
});

// tab.removed — a tab was closed
manager.events.on('tab.removed', ({ tab, adjacent }) => {
  console.log(`Closed "${tab.title}", adjacent: ${adjacent?.title}`);
});

// tab.dirtied — isDirty flipped false → true
manager.events.on('tab.dirtied', ({ tab }) => {
  document.title = `* ${tab.title}`;
});

// tab.cleaned — isDirty flipped true → false (after saveXML)
manager.events.on('tab.cleaned', ({ tab }) => {
  document.title = tab.title;
});

// tab.lifecycle — lifecycle changed (idle → loading → ready / error)
manager.events.on('tab.lifecycle', ({ tab, prev }) => {
  console.log(`${prev} → ${tab.lifecycle}`);
});
```

---

### Cross-tab SubProcess Reuse

The `SubprocessStore` (bpmn-js service) lives on the single shared modeler instance — not on individual tabs. This means any subprocess you import in Tab A is automatically available in Tab B, Tab C, etc.

```
User in Tab A: imports "Payment Process.bpmn"  →  SubprocessStore.add(item)
User switches to Tab B
User drags "Payment Process" from palette      →  Placed into Tab B's diagram
```

No extra API calls needed — the store persists across tab switches.

---

### BeforeActivate Hook

Register a guard that runs before every tab switch. Return `false` (or `Promise<false>`) to cancel.

```typescript
// Example: warn before leaving a dirty tab
import { TabManager } from 'csp-bpmn';

const manager = new TabManager();

manager.setBeforeActivate(async (current, next) => {
  if (!current?.isDirty) return true;
  return confirm(`"${current.title}" has unsaved changes. Switch anyway?`);
});
```

---

### Tab State Machine

```
         add()
          │
          ▼
        idle  ──── importXML fails ──►  error
          │
     importXML starts
          │
          ▼
       loading
          │
     importXML done
          │
          ▼
        ready  ◄──── importXML (re-load on tab switch)
          │
   commandStack.changed
          │
     markDirty()
          │
      isDirty = true  ─── saveXML() ──►  isDirty = false
```

---

### Internal Architecture — how tab switching works

```
User clicks Tab B
     │
     ▼
TabBarUI.onActivate("tab-B")
     │
     ▼
CspBpmnStudioElement._switchToTab("tab-B")
     │
     ├── 1. modeler.saveXML()         ← snapshot current diagram XML
     │   modeler.getViewbox()         ← snapshot viewport (zoom + scroll)
     │   tabManager.snapshot(currentId, xml, viewbox)
     │
     ├── 2. tabManager.activate("tab-B")   ← BeforeActivateHook runs here
     │   emits: tab.activated { prev, next }
     │   TabBarUI re-renders (active tab highlight moves)
     │
     └── 3. modeler.importXML(tabB.xml)    ← load Tab B's diagram
         modeler.setViewbox(tabB.viewbox)  ← restore viewport
         customPropertiesProvider.clearStore()  ← clear stale panel cache
         tabManager.setLifecycle("tab-B", "ready")
```

One modeler instance is shared. The "multi-tab" effect is achieved by save/restore of XML + viewport on every switch. Trade-off: undo/redo history is per-session (lost on tab switch — content is always preserved).

---

### Lower-level API: using `TabManager` standalone

`TabManager`, `TabStore`, and `TypedEventBus` are exported individually for use outside the studio:

```typescript
import { TabManager, TypedEventBus } from 'csp-bpmn';

const manager = new TabManager({ maxTabs: 10, defaultTitle: 'Flow' });

const tabA = manager.add({ title: 'Flow A', xml: flowAXml });
const tabB = manager.add({ title: 'Flow B' });

await manager.activate(tabA.id);

manager.markDirty(tabA.id);
manager.markClean(tabA.id);

manager.patch(tabA.id, { title: 'Renamed Flow A' });
manager.move(tabA.id, 1);  // reorder

manager.dispose();  // clear all tabs + listeners
```

---

## TypeScript Types

All public types are exported from the package root:

```typescript
import type {
  // Config
  CSPBpmConfig,
  BpmStudioMode,
  BpmnProvider,
  // Elements
  BpmnElement,
  BpmnEventType,
  BpmnEventCallback,
  // bpmn-js service wrappers
  BpmnCanvas,
  BpmnViewbox,
  BpmnEventBus,
  BpmnCommandStack,
  BpmnElementRegistry,
  // Subprocess
  SubprocessItem,
  ExportXmlResult,
  ExportSvgResult,
  // Multi-tab
  DiagramTabState,
  TabLifecycle,
  ViewboxSnapshot,
  AddTabConfig,
  TabManagerConfig,
  TabEventMap,
  TabEvent,
  BeforeActivateHook,
} from 'csp-bpmn';
```

---

---

## Design Patterns — Ghi chú học thuật

Phần này ghi lại các kỹ thuật và design pattern được áp dụng trong codebase, kèm giải thích lý do chọn và cách vận hành. Mục đích để bạn học và tái sử dụng trong các dự án khác.

---

### 1. Repository Pattern — `TabStore`

**File:** `src/lib/multi/tab-store.ts`

**Định nghĩa:** Repository tách biệt logic truy cập dữ liệu khỏi business logic. Nó cung cấp interface CRUD rõ ràng; caller không cần biết dữ liệu được lưu ở đâu hay như thế nào.

**Trong dự án:**

```typescript
class TabStore {
  private readonly _map   = new Map<string, DiagramTabState>();  // lookup O(1)
  private readonly _order = string[];                             // display order
  private _activeId: string | null = null;

  add(tab):    void
  remove(id):  DiagramTabState | undefined
  patch(id):   DiagramTabState | undefined    // partial update
  get(id):     DiagramTabState | undefined
  getAll():    DiagramTabState[]              // trả về theo thứ tự _order
  getAdjacentTo(id):  DiagramTabState | undefined  // nearest sibling
  move(id, toIndex):  boolean                // reorder
}
```

**Tại sao dùng `Map` + `Array` riêng biệt?**

| Cấu trúc | Read by id | Ordered iteration | Reorder |
|-----------|-----------|-------------------|---------|
| `Map` chỉ | O(1) | Không giữ order |Không thể |
| `Array` chỉ | O(n) find | O(n) | O(n) splice |
| `Map` + `Array` | O(1) | O(n) nhưng đúng order | O(n) splice |

`Map` xử lý lookup, `Array` xử lý ordering — tách concern, tối ưu cả hai.

**Bài học:**
> Khi bạn cần vừa lookup nhanh vừa ordered traversal, tách thành hai cấu trúc. Đây là pattern phổ biến trong state stores.

---

### 2. Observer Pattern — `TypedEventBus`

**File:** `src/lib/multi/typed-event-bus.ts`

**Định nghĩa:** Cho phép nhiều subscriber lắng nghe các event mà không cần biết ai publish. Còn được gọi là EventEmitter, Pub/Sub.

**Điểm đặc biệt: Generic type constraint**

```typescript
// TMap là một "event schema" — map từ tên event → kiểu payload
class TypedEventBus<TMap extends Record<string, any>> {

  on<K extends keyof TMap>(
    event:   K,
    handler: (payload: TMap[K]) => void,   // ← TypeScript suy ra đúng kiểu payload
  ): () => void                             // trả về hàm unsubscribe

  emit<K extends keyof TMap>(event: K, payload: TMap[K]): void
}

// Dùng với TabEventMap:
const bus = new TypedEventBus<TabEventMap>();

bus.on('tab.activated', ({ prev, next }) => {
  // TypeScript biết prev: DiagramTabState | null, next: DiagramTabState
  console.log(next.title);  // ✓ auto-complete
});

bus.emit('tab.activated', { prev: null, next: tab });  // ✓
bus.emit('tab.activated', { wrong: 'data' });           // ✗ compile error
```

**Tại sao dùng `Record<string, any>` thay vì `unknown`?**

`Record<string, unknown>` không cho phép dùng interface cụ thể (vì interface không có index signature). `Record<string, any>` cho phép interface đồng thời vẫn enforce key/value types qua generic `K`.

**Error isolation:**

```typescript
emit<K>(event: K, payload: TMap[K]): void {
  for (const handler of handlers) {
    try {
      handler(payload);
    } catch (err) {
      console.error(`Handler error for "${event}":`, err);
      // Tiếp tục gọi các handlers còn lại — một handler lỗi không chặn cả hệ thống
    }
  }
}
```

**Bài học:**
> Observer giải quyết vấn đề coupling. Module A muốn thông báo cho module B mà không import B trực tiếp. Generic type bus thêm compile-time safety lên trên mô hình pub/sub truyền thống.

---

### 3. Mediator Pattern — `TabManager`

**File:** `src/lib/multi/tab-manager.ts`

**Định nghĩa:** Mediator điều phối giao tiếp giữa nhiều đối tượng. Thay vì A → B → C giao tiếp trực tiếp, tất cả đi qua Mediator. Giảm coupling nhiều chiều.

**Trong dự án:**

```
TabBarUI ──────────────────────────────────┐
CspBpmnStudioElement ──────────────────────┤
                                           ▼
                                      TabManager  ◄──── sở hữu ───► TabStore
                                           │                         TypedEventBus
                                           │
                                    phát ra events
                                           │
                          ┌────────────────┴───────────────┐
                          ▼                                 ▼
                       TabBarUI                    CspBpmnStudioElement
                    (re-renders)                  (loads XML, restores viewport)
```

`TabBarUI` và `CspBpmnStudioElement` không biết đến nhau. Cả hai chỉ nói chuyện với `TabManager`.

```typescript
class TabManager {
  readonly events = new TypedEventBus<TabEventMap>();  // ai cũng có thể lắng nghe
  private readonly _store: TabStore;                   // không ai ngoài đây chạm vào

  async activate(id: string): Promise<boolean> {
    // 1. validate
    // 2. call beforeActivate hook (Strategy)
    // 3. update store
    // 4. emit event → TabBarUI re-renders, Studio loads XML
    this.events.emit('tab.activated', { prev, next });
  }
}
```

**Bài học:**
> Khi 3+ object cần giao tiếp với nhau, introduce một Mediator. Nó giữ logic giao tiếp tập trung, dễ test (chỉ cần test Mediator), và cho phép thêm subscriber mới mà không sửa code cũ (Open/Closed Principle).

---

### 4. Strategy Pattern — `BeforeActivateHook`

**File:** `src/lib/multi/tab-manager.ts`

**Định nghĩa:** Strategy cho phép thay thế một thuật toán (hành vi) tại runtime mà không thay đổi context sử dụng nó.

**Trong dự án:** Hành vi trước khi switch tab là "chiến lược" có thể thay thế:

```typescript
// Mặc định: không có hook, switch tự do
const manager = new TabManager();

// Strategy 1: Confirm khi tab dirty
manager.setBeforeActivate(async (current, next) => {
  if (!current?.isDirty) return true;
  return confirm(`Leave "${current.title}" with unsaved changes?`);
});

// Strategy 2: Auto-save trước khi switch
manager.setBeforeActivate(async (current, _next) => {
  if (current?.isDirty) await autoSave(current);
  return true;
});

// Xóa hook
manager.setBeforeActivate(null);
```

`TabManager.activate()` không biết và không cần biết "policy" nào đang được dùng:

```typescript
async activate(id: string): Promise<boolean> {
  if (this._beforeActivate) {                         // ← kiểm tra có strategy không
    const allowed = await this._beforeActivate(...);  // ← gọi strategy
    if (!allowed) return false;
  }
  // ... tiếp tục switch
}
```

**Bài học:**
> Khi một bước trong quy trình có thể thay đổi tuỳ theo ngữ cảnh/consumer, đừng hardcode — inject nó như một hàm hoặc interface. Đây là lý do JavaScript first-class functions rất mạnh.

---

### 5. Factory Pattern — `TabManager.add()`

**File:** `src/lib/multi/tab-manager.ts`

**Định nghĩa:** Factory đóng gói logic khởi tạo object. Caller không cần biết chi tiết cấu trúc bên trong.

```typescript
// Caller chỉ cần biết config tối thiểu:
const tab = manager.add({ title: 'My Process', xml: someXml });

// TabManager tự lo:
add(config: AddTabConfig = {}): DiagramTabState {
  this._tabSeq++;
  const tab: DiagramTabState = {
    id:        `tab-${Date.now()}-${++_seq}`,   // id unique
    index:     this._tabSeq,                     // monotonic
    title:     config.title ?? `Diagram ${this._tabSeq}`,
    isDirty:   false,
    lifecycle: 'idle',
    xml:       config.xml ?? '',
    viewbox:   config.viewbox ?? null,
    createdAt: Date.now(),
    metadata:  { ...config.metadata },
  };
  this._store.add(tab);
  this.events.emit('tab.added', { tab });
  return tab;
}
```

**Bài học:**
> Factory pattern là "constructor có tên". Khi object creation phức tạp (phải set nhiều default, generate ID, trigger side effects), ẩn đi trong factory thay vì để caller tự làm.

---

### 6. Facade Pattern — `CSPBpm`

**File:** `src/lib/facade/csp-bpmn-facade.ts`

**Định nghĩa:** Facade cung cấp interface đơn giản cho một hệ thống phức tạp bên trong.

**Trong dự án:**

```
Người dùng gọi:
  bpm.addTab({ title: 'Flow A', xml: myXml })

Facade thực ra làm:
  this.studioEl.addTab(config)           ← gọi vào Web Component trong iframe
    → TabManager.add(config)             ← tạo DiagramTabState
    → CspBpmnStudioElement._switchToTab  ← async: saveXML + importXML + setViewbox
    → TabBarUI re-renders                ← EventBus notifies TabBarUI
```

Người dùng thấy một hàm `async addTab()`. Bên trong là 5 lớp hoạt động phối hợp.

**Bài học:**
> Facade giải phóng consumer khỏi sự phức tạp. Nhưng không nên làm Facade quá "dày" — chỉ expose những gì consumer thực sự cần. Complexity vẫn tồn tại bên trong, chỉ là ẩn đi.

---

### 7. Async Coordination — `_tabsReady` Promise Gate

**File:** `src/lib/studio/csp-bpmn-studio.ts`

**Vấn đề:** `createInstance()` (tạo modeler) là sync, nhưng `_initTabsAfterCreate()` (load XML vào tab đầu tiên) là async. Nếu user gọi `loadXML()` ngay sau `InitBpm()`, có thể xảy ra race condition.

**Giải pháp: Promise Gate**

```typescript
private _tabsReady: Promise<void> = Promise.resolve();

private createInstance(): void {
  // ... tạo modeler (sync) ...
  this._tabsReady = this._initTabsAfterCreate();  // lưu promise, không await
}

async loadXML(xml: string): Promise<void> {
  await this._tabsReady;  // ← chờ tabs sẵn sàng trước khi làm gì
  // ... tiếp tục ...
}
```

**Timeline:**

```
t=0  createInstance() → modeler created → _tabsReady = initTabsAfterCreate() [starts]
t=1  user calls loadXML() → await _tabsReady → [waits]
t=2  initTabsAfterCreate() done → _tabsReady resolves
t=2  loadXML continues
```

Nếu `initTabsAfterCreate()` đã xong trước khi `loadXML()` chạy, `await _tabsReady` resolve ngay lập tức (Promise đã settled).

**Bài học:**
> Khi có hai async operation phải chạy tuần tự nhưng bạn không control được thời điểm trigger của cái sau, dùng một Promise làm "gate" (cổng chặn). Pattern này phổ biến hơn bạn nghĩ — mọi thư viện có `ready` / `initialized` promise đều dùng nó.

---

### 8. Guard Flag — `_switching`

**File:** `src/lib/studio/csp-bpmn-studio.ts`

**Vấn đề:** `_switchToTab()` là async. Nếu user click tab liên tục trong khi switch đang chạy, nhiều switch chạy song song → corrupt state.

**Giải pháp: Mutex flag**

```typescript
private _switching = false;

private async _switchToTab(nextId: string): Promise<boolean> {
  if (this._switching) return false;  // ← reject nếu đang bận
  this._switching = true;

  try {
    // ... save current → activate → load next ...
    return true;
  } finally {
    this._switching = false;  // ← luôn release, kể cả khi throw
  }
}
```

`finally` đảm bảo flag luôn được reset — không bị stuck dù có exception.

**Liên hệ với `_writing` trong `CustomPropertiesProvider`:** Cùng pattern nhưng purpose khác — ngăn re-render loop khi chính code đang ghi vào extensionElements:

```typescript
private _writing = false;

private _writeToExtensionElements(...): void {
  this._writing = true;
  this._modeling.updateProperties(element, { extensionElements: extEl });
  this._writing = false;  // sync, không cần try/finally
}

// Event handler:
this._eventBus.on('commandStack.changed', () => {
  if (this._writing) return;  // ← bỏ qua event do chính mình gây ra
  this._render();
});
```

**Bài học:**
> Boolean flag `isProcessing` / `_writing` / `_switching` là cách đơn giản nhất để tránh re-entrant calls và feedback loop. Luôn dùng `try/finally` khi flag bảo vệ async code.

---

### 9. Typed Generic Event Map

**File:** `src/lib/multi/types.ts` + `typed-event-bus.ts`

Pattern khai báo toàn bộ "schema" của hệ thống event vào một interface:

```typescript
// Khai báo một lần, dùng khắp nơi
interface TabEventMap {
  'tab.added':     { readonly tab: DiagramTabState };
  'tab.removed':   { readonly tab: DiagramTabState; readonly adjacent: DiagramTabState | null };
  'tab.activated': { readonly prev: DiagramTabState | null; readonly next: DiagramTabState };
  'tab.dirtied':   { readonly tab: DiagramTabState };
  // ...
}

// Khi gọi, TypeScript enforce cả key lẫn payload:
bus.emit('tab.removed', { tab, adjacent });   // ✓
bus.emit('tab.removed', { tab });              // ✗ missing adjacent
bus.emit('tab.renamed', { tab });              // ✗ event không tồn tại

bus.on('tab.activated', ({ prev, next }) => {
  next.title    // ✓ TypeScript biết đây là DiagramTabState
  next.invalid  // ✗ compile error
});
```

**So sánh với EventEmitter truyền thống (Node.js):**

```typescript
// Node.js: không type-safe
emitter.on('tab.activated', (data: any) => {
  data.next.tile  // typo → runtime error, không bắt được lúc compile
});

// TypedEventBus: type-safe
bus.on('tab.activated', ({ prev, next }) => {
  next.tile  // ✗ Property 'tile' does not exist on type 'DiagramTabState' → compile error
});
```

**Bài học:**
> Khi design event system, đầu tư vào việc type schema ngay từ đầu. Chi phí thêm một interface nhỏ, lợi ích là toàn bộ codebase được bảo vệ khỏi typo và payload sai.

---

### 10. Reconciliation thay vì Full Re-render

**File:** `src/lib/studio/tab-bar/tab-bar-ui.ts`

`TabBarUI._render()` hiện tại dùng `innerHTML = ''` rồi build lại toàn bộ tab list. Đây là "naïve reconciliation" — đơn giản, không tối ưu.

```typescript
private _render(): void {
  this._list.innerHTML = '';           // clear all
  for (const tab of this._manager.getAll()) {
    this._list.appendChild(this._createTabEl(tab, ...));  // rebuild
  }
}
```

Trong thực tế production, bạn nên dùng **keyed reconciliation** (như React/Vue làm): so sánh old DOM với new state, chỉ update những gì thay đổi. Điều này tránh:
- Mất trạng thái focus
- Flicker trong inline-rename input
- Performance với nhiều tabs

Pattern đơn giản hơn Virtual DOM: dùng `data-tab-id` làm key:

```typescript
// Pseudo-code reconciliation đơn giản
private _render(): void {
  const tabs = this._manager.getAll();
  const existingIds = new Set([...this._list.children].map(el => el.dataset.tabId));
  const newIds = new Set(tabs.map(t => t.id));

  // Remove stale tabs
  for (const id of existingIds) {
    if (!newIds.has(id)) this._list.querySelector(`[data-tab-id="${id}"]`)?.remove();
  }

  // Add / update tabs
  for (const tab of tabs) {
    const existing = this._list.querySelector(`[data-tab-id="${tab.id}"]`);
    if (existing) {
      this._updateTabEl(existing, tab, tab.id === activeId);  // update in place
    } else {
      this._list.appendChild(this._createTabEl(tab, ...));     // add new
    }
  }
}
```

**Bài học:**
> Full re-render đơn giản và đủ tốt cho ít items. Khi có vấn đề về UX (focus loss) hoặc performance, migrate sang keyed reconciliation. Đây là lý do React ra đời — nó tự động làm bước này.

---

### Tóm tắt Design Patterns trong dự án

| Pattern | File chính | Giải quyết vấn đề gì |
|---------|-----------|----------------------|
| **Repository** | `tab-store.ts` | Tách data access khỏi business logic; cung cấp CRUD interface rõ ràng |
| **Observer** | `typed-event-bus.ts` | Decoupled communication; A thông báo cho B mà không import B |
| **Mediator** | `tab-manager.ts` | Điều phối nhiều objects; tránh coupling nhiều chiều |
| **Strategy** | `BeforeActivateHook` | Thay thế behavior tại runtime mà không sửa context |
| **Factory** | `TabManager.add()` | Đóng gói object creation; ẩn default values + side effects |
| **Facade** | `csp-bpmn-facade.ts` | Simplify complex subsystem; single API surface |
| **Promise Gate** | `_tabsReady` | Coordinate async initialization; prevent race conditions |
| **Guard Flag** | `_switching`, `_writing` | Prevent re-entrant async calls; prevent feedback loops |
| **Generic Type Map** | `TabEventMap` | Compile-time safety for event names + payloads |
| **Web Component** | `CspBpmnStudioElement` | Self-contained custom element với Shadow DOM isolation |

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

## Rollup Hooks & Vite Plugin Lifecycle

Vite dùng **Rollup** bên dưới để bundle. Rollup expose một hệ thống **hook** — các điểm cắm vào trong quá trình build mà plugin có thể đăng ký callback.

### Vòng đời của một Rollup build

```
[1] options       ← đọc & transform config
[2] buildStart    ← bắt đầu build
[3] resolveId     ← tìm đường dẫn của từng import
[4] load          ← đọc nội dung file
[5] transform     ← biến đổi code (transpile TS, inline CSS...)
[6] buildEnd      ← kết thúc parse toàn bộ modules
[7] renderChunk   ← sinh ra code cho từng chunk
[8] writeBundle   ← ghi file ra disk
[9] closeBundle   ← dọn dẹp
```

Mỗi bước trên là một hook. Plugin đăng ký hàm vào hook nào thì được gọi đúng lúc đó:

```ts
const myPlugin = {
  name: 'my-plugin',

  buildStart() {
    // Chạy MỘT LẦN khi Rollup bắt đầu build
  },

  transform(code, id) {
    // Chạy cho MỖI FILE được import
    if (id.endsWith('.txt')) {
      return `export default ${JSON.stringify(code)}`;
    }
  },

  closeBundle() {
    // Chạy SAU KHI tất cả file đã được ghi ra disk
  },
};
```

### Vite mở rộng Rollup hooks

Vite dùng Rollup để build (`npm run build`), nhưng với dev server thì Vite tự xử lý theo cách riêng. Vì vậy Vite **thêm hook của riêng mình** mà Rollup không có:

| Hook | Thuộc về | Khi nào chạy |
|------|----------|-------------|
| `buildStart` | Rollup | Build mode: trước khi bundle. Dev mode: per-request transform, không đảm bảo thứ tự |
| `transform` | Rollup | Mỗi khi một file được request hoặc bundle |
| `configureServer` | **Vite only** | Dev mode: trong lúc setup HTTP server, **trước mọi request** |
| `configResolved` | **Vite only** | Sau khi config được resolve xong |
| `handleHotUpdate` | **Vite only** | Khi file thay đổi (HMR) |

### Tại sao `buildStart` không đủ cho dev mode

Dự án này cần `temp/studio-bundle.js` tồn tại trước khi Vite resolve import `?raw`. Đây là lý do `buildStart` không hoạt động trong dev mode:

```
Vite dev server lifecycle:
  1. config resolved
  2. configureServer()        ← Vite hook, TRƯỚC khi server listen
  3. Server bắt đầu nhận request
  4. Browser request file.ts
  5. transform() chạy
     → vite:import-analysis  ← tìm file ?raw, THROW nếu không có
  6. buildStart()             ← Rollup hook, fire lúc này (SAU bước 5)
```

`buildStart` không phải "trước khi server chạy" mà là "trước khi Rollup bắt đầu bundle một module" — trong dev mode điều đó xảy ra **per-request**, tức là sau khi `import-analysis` đã fail rồi.

**Giải pháp dùng trong dự án này** (`vite.config.ts`):

```ts
function ensureStudioBundle(): Plugin {
  return {
    name: 'csp-ensure-studio-bundle',
    configureServer() { runPhase1IfNeeded(); },  // dev: trước mọi request
    buildStart()      { runPhase1IfNeeded(); },  // build: safety net
  };
}
```

---

## License

MIT
