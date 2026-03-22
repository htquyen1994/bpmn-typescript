# bpmn-js Mastery Guide

Tài liệu tham khảo tổng hợp — tổ chức theo dạng **"Cần làm gì → Dùng cái nào"**.

---

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Khởi tạo Modeler / Viewer](#2-khởi-tạo-modeler--viewer)
3. [Services — Bảng tra cứu nhanh](#3-services--bảng-tra-cứu-nhanh)
4. [Canvas — Zoom, Scroll, Viewport](#4-canvas--zoom-scroll-viewport)
5. [EventBus — Lắng nghe và phát sự kiện](#5-eventbus--lắng-nghe-và-phát-sự-kiện)
6. [CommandStack — Undo / Redo](#6-commandstack--undo--redo)
7. [ElementRegistry — Tìm và duyệt elements](#7-elementregistry--tìm-và-duyệt-elements)
8. [Modeling — Thay đổi diagram có undo](#8-modeling--thay-đổi-diagram-có-undo)
9. [moddle — Tạo và parse BPMN objects](#9-moddle--tạo-và-parse-bpmn-objects)
10. [Palette — Thêm nút vào thanh công cụ](#10-palette--thêm-nút-vào-thanh-công-cụ)
11. [PopupMenu — Menu ngữ cảnh](#11-popupmenu--menu-ngữ-cảnh)
12. [Custom Renderer — Thay đổi giao diện element](#12-custom-renderer--thay-đổi-giao-diện-element)
13. [DI Container — Đăng ký Plugin / Module](#13-di-container--đăng-ký-plugin--module)
14. [Config Injection — Truyền dữ liệu ngoài vào plugin](#14-config-injection--truyền-dữ-liệu-ngoài-vào-plugin)
15. [moddle Types — Bảng tham chiếu](#15-moddle-types--bảng-tham-chiếu)
16. [Event Reference — Bảng sự kiện](#16-event-reference--bảng-sự-kiện)
17. [Recipes — Công thức hoàn chỉnh](#17-recipes--công-thức-hoàn-chỉnh)

---

## 1. Kiến trúc tổng quan

```
┌──────────────────────────────────────────────────┐
│                   bpmn-js                        │
│                                                  │
│  ┌────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │   Modeler  │  │NavigatedView│  │  Viewer  │  │
│  └─────┬──────┘  └──────┬──────┘  └────┬─────┘  │
│        │                │              │         │
│        └────────────────┴──────────────┘         │
│                         │                        │
│              ┌──────────▼──────────┐             │
│              │  diagram-js (core)  │             │
│              │  ┌───────────────┐  │             │
│              │  │  DI Container │  │             │
│              │  │  (didi/Injector)│ │            │
│              │  └───────┬───────┘  │             │
│              │          │          │             │
│  ┌───────────▼──────────▼──────────▼──────────┐  │
│  │           Services (singletons)             │  │
│  │  canvas  eventBus  commandStack  modeling  │  │
│  │  elementRegistry  moddle  palette  popup   │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Hai tầng của bpmn-js

| Tầng | Mô tả | Ví dụ |
|------|-------|-------|
| **Semantic (business)** | Cây BPMN objects, parse từ XML | `bpmn:Process`, `bpmn:Task`, `bpmn:SubProcess` |
| **Diagram (DI)** | Vị trí, kích thước trên canvas | `bpmndi:BPMNShape`, `dc:Bounds` |

Mỗi shape trên canvas có:
- `element.businessObject` → object semantic (tên, type, extensionElements...)
- `element.x/y/width/height` → layout trên canvas

---

## 2. Khởi tạo Modeler / Viewer

### Modeler (chỉnh sửa)

```typescript
import Modeler from 'bpmn-js/lib/Modeler';
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel';
import GridModule from 'diagram-js-grid';
import activitiModdle from 'activiti-bpmn-moddle/resources/activiti.json';

const modeler = new Modeler({
  container:       '#canvas',           // DOM element hay CSS selector

  // Properties panel
  propertiesPanel: { parent: '#panel' },

  // Thêm plugins/modules
  additionalModules: [
    BpmnPropertiesPanelModule,
    BpmnPropertiesProviderModule,
    GridModule,
    MyCustomModule,           // module tự viết
  ],

  // Moddle extensions (Activiti, Camunda...)
  moddleExtensions: {
    activiti: activitiModdle,
    // camunda: camundaModdle,
  },

  // Config injection cho plugins (xem mục 14)
  subprocessSources: [new TabDiagramSource(...)],
});
```

### NavigatedViewer (xem, có pan/zoom)

```typescript
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';

const viewer = new NavigatedViewer({
  container: '#canvas',
  additionalModules: [CustomRendererModule],
});
```

### Import / Export XML

```typescript
// Import
const { warnings } = await modeler.importXML(xmlString);
if (warnings.length) console.warn(warnings);

// Export
const { xml } = await modeler.saveXML({ format: true });  // format: pretty print

// Export SVG
const { svg } = await modeler.saveSVG();
```

### Lifecycle

```typescript
modeler.destroy();  // cleanup DOM + events + services
```

---

## 3. Services — Bảng tra cứu nhanh

Lấy service từ modeler instance:

```typescript
const service = modeler.get('serviceName') as ServiceType;
```

| Muốn làm gì | Service | Tên inject |
|-------------|---------|-----------|
| Zoom, scroll canvas | `BpmnCanvas` | `'canvas'` |
| Lắng nghe / phát events | `BpmnEventBus` | `'eventBus'` |
| Undo / Redo | `BpmnCommandStack` | `'commandStack'` |
| Tìm element theo ID | `BpmnElementRegistry` | `'elementRegistry'` |
| Sửa properties có undo | `BpmnModeling` | `'modeling'` |
| Parse / tạo BPMN objects | `BpmnModdle` | `'moddle'` |
| Thêm palette entry | `BpmnPalette` | `'palette'` |
| Mở popup menu | `BpmnPopupMenu` | `'popupMenu'` |
| Tạo shape mới | `BpmnElementFactory` | `'elementFactory'` |
| Minimap | `BpmnMinimap` | `'minimap'` |
| Custom renderer cơ bản | `BpmnRendererService` | `'bpmnRenderer'` |
| Lấy selected elements | `BpmnSelection` | `'selection'` |
| Kiểm tra rules | `BpmnRules` | `'rules'` |

### TypeScript — cách truy cập an toàn

```typescript
// Trực tiếp (khi ở ngoài plugin)
const canvas = modeler.get('canvas') as BpmnCanvas;

// Trong plugin (constructor injection)
class MyService {
  static $inject = ['canvas', 'eventBus'];
  constructor(
    private readonly _canvas: BpmnCanvas,
    private readonly _eventBus: BpmnEventBus,
  ) {}
}

// Fallback an toàn (khi service có thể không tồn tại)
get minimap(): BpmnMinimap | null {
  try { return this._instance.get('minimap') as BpmnMinimap; }
  catch { return null; }
}
```

---

## 4. Canvas — Zoom, Scroll, Viewport

### Zoom

```typescript
const canvas = modeler.get('canvas') as BpmnCanvas;

canvas.zoom('fit-viewport');        // fit toàn bộ diagram
canvas.zoom(1.0);                   // reset 100%
canvas.zoom(canvas.zoom() * 1.1);  // zoom in 10%
canvas.zoom(canvas.zoom() * 0.9);  // zoom out 10%

const level = canvas.zoom();       // lấy giá trị hiện tại
```

### Scroll

```typescript
canvas.scroll({ dx: 50, dy: -30 }); // pan canvas
```

### Viewport snapshot (lưu/khôi phục vị trí)

```typescript
// Lưu
const vb = canvas.viewbox();
// { x, y, width, height, scale }

// Khôi phục
canvas.viewbox({ x: vb.x, y: vb.y, width: vb.width, height: vb.height });
```

### Root element

```typescript
const root = canvas.getRootElement();
// { id: 'Process_1', type: 'bpmn:Process' }
```

### Container DOM

```typescript
const container: HTMLElement = canvas.getContainer();
```

---

## 5. EventBus — Lắng nghe và phát sự kiện

### Subscribe

```typescript
const eventBus = modeler.get('eventBus') as BpmnEventBus;

// Lắng nghe 1 sự kiện
eventBus.on('commandStack.changed', (e) => {
  console.log('diagram modified');
});

// Lắng nghe sự kiện có payload cụ thể
eventBus.on('selection.changed', (e) => {
  const selected: BpmnDiagramElement[] = e.newSelection;
});

// Với priority (số cao hơn = chạy trước)
eventBus.on('element.changed', 1500, (e) => { /* runs before priority-1000 handlers */ });
```

### Unsubscribe

```typescript
const handler = (e: Record<string, unknown>) => { ... };
eventBus.on('commandStack.changed', handler);
// ...sau này...
eventBus.off('commandStack.changed', handler);
```

### Phát sự kiện custom

```typescript
eventBus.fire('subprocess.create', { item: myItem });
eventBus.fire('subprocess.import-request');
```

### Lắng nghe sự kiện custom

```typescript
eventBus.on('subprocess.create', (e: Record<string, unknown>) => {
  const item = e['item'] as SubprocessItem;
  handleCreate(item);
});
```

### Pattern: cleanup trong plugin

```typescript
class MyService {
  static $inject = ['eventBus'];
  constructor(eventBus: BpmnEventBus) {
    const onChanged = () => { ... };
    eventBus.on('commandStack.changed', onChanged);

    // Dọn dẹp khi diagram bị destroy
    eventBus.on('diagram.destroy', () => {
      eventBus.off('commandStack.changed', onChanged);
    });
  }
}
```

---

## 6. CommandStack — Undo / Redo

### Undo / Redo

```typescript
const stack = modeler.get('commandStack') as BpmnCommandStack;

stack.undo();
stack.redo();

const canUndo = stack.canUndo();
const canRedo = stack.canRedo();
```

### Theo dõi thay đổi

```typescript
// Cách 1: event (mọi command sau undo/redo/execute)
eventBus.on('commandStack.changed', () => {
  markDirty();
});

// Cách 2: lắng nghe command cụ thể
eventBus.on('commandStack.shape.move.execute', (e) => {
  const { context } = e;
  console.log('moved:', context.shape.id);
});
```

---

## 7. ElementRegistry — Tìm và duyệt elements

```typescript
const registry = modeler.get('elementRegistry') as BpmnElementRegistry;

// Lấy 1 element
const el: BpmnDiagramElement | undefined = registry.get('Task_1');

// Lấy tất cả
const all: BpmnDiagramElement[] = registry.getAll();

// Filter
const tasks = registry.filter((el) => el.type === 'bpmn:Task');
const userTasks = registry.filter((el) =>
  el.businessObject?.$type === 'bpmn:UserTask'
);
```

### BpmnDiagramElement

```typescript
interface BpmnDiagramElement {
  id:             string;                 // shape ID
  type:           string;                 // 'bpmn:Task', 'bpmn:StartEvent'...
  businessObject: BpmnBusinessObject;     // semantic object (name, extensions...)
  parent?:        BpmnDiagramElement;     // parent container
  x: number; y: number;                  // position
  width: number; height: number;         // size
}
```

### Lấy tên element

```typescript
const name = el.businessObject?.name;   // có thể undefined
```

### Kiểm tra loại element với `is()`

```typescript
import { is } from 'bpmn-js/lib/util/ModelUtil';

if (is(element, 'bpmn:Activity')) { ... }  // true cho Task, SubProcess, CallActivity...
if (is(element, 'bpmn:Event'))    { ... }  // true cho Start/End/Intermediate events
if (is(element, 'bpmn:Gateway'))  { ... }  // true cho XOR, AND, OR gateways
```

---

## 8. Modeling — Thay đổi diagram có undo

Tất cả thay đổi qua `modeling` đều được ghi vào undo stack.

```typescript
const modeling = modeler.get('modeling') as BpmnModeling;
```

### Cập nhật properties

```typescript
// Đổi tên element
modeling.updateProperties(element, { name: 'My New Name' });

// Đổi process name (root)
const root = canvas.getRootElement();
modeling.updateProperties(root as any, { name: 'My Process' });

// Đổi nhiều thuộc tính cùng lúc
modeling.updateProperties(element, {
  name:        'Updated Task',
  isExecutable: true,
});
```

### Di chuyển shape

```typescript
modeling.moveShape(element, { x: 100, y: 50 });
```

### Tạo shape mới (có undo)

```typescript
const elementFactory = modeler.get('elementFactory') as BpmnElementFactory;

const newShape = elementFactory.createShape({ type: 'bpmn:Task' });
modeling.createShape(newShape, { x: 300, y: 200 }, parentElement);
```

### Xóa element

```typescript
modeling.removeElements([element]);
```

### Lưu ý quan trọng

`modeling` chỉ có trong `Modeler`, **không có** trong `NavigatedViewer` hay `Viewer`. Luôn try/catch khi không chắc:

```typescript
try {
  this.modeler.modeling.updateProperties(root as any, { name });
} catch { /* viewer mode — silent fail */ }
```

---

## 9. moddle — Tạo và parse BPMN objects

`moddle` là layer serialize/deserialize BPMN. Dùng để tạo objects thủ công (không qua UI) và merge XML.

```typescript
const moddle = modeler.get('moddle') as BpmnModdle;
```

### Parse XML → object tree

```typescript
const { rootElement, warnings } = await moddle.fromXML(xmlString);
// rootElement: BpmnDefinitions
// rootElement.rootElements[] → [bpmn:Process, ...]
// rootElement.diagrams[] → [bpmndi:BPMNDiagram, ...]
```

### Serialize object tree → XML

```typescript
const { xml } = await moddle.toXML(rootElement, { format: true });
```

### Tạo object thủ công

```typescript
// SubProcess
const subprocess = moddle.create('bpmn:SubProcess', {
  id:   'SubProcess_1',
  name: 'My SubProcess',
});
subprocess.flowElements = [];

// Shape (DI layer)
const shape = moddle.create('bpmndi:BPMNShape', {
  id:          'SubProcess_1_di',
  bpmnElement: subprocess,
  isExpanded:  false,
});
shape.bounds = moddle.create('dc:Bounds', {
  x: 300, y: 200, width: 100, height: 80,
});

// BPMNPlane cho drill-down
const plane = moddle.create('bpmndi:BPMNPlane', {
  id:          'SubProcess_1_plane',
  bpmnElement: subprocess,
});

// BPMNDiagram wrapper
const diagram = moddle.create('bpmndi:BPMNDiagram', {
  id: 'BPMNDiagram_subprocess',
});
diagram.plane = plane;

// Extension elements
const ext = moddle.create('bpmn:ExtensionElements', {
  values: [],
});

// Activiti property
const prop = moddle.create('activiti:Property', {
  name:  'myKey',
  value: 'myValue',
});
const props = moddle.create('activiti:Properties', {
  values: [prop],
});
```

### Đặt $parent (bắt buộc khi thêm child)

```typescript
// Khi thêm flowElement vào process, phải set $parent
subprocess.$parent = process;
process.flowElements.push(subprocess);

for (const fe of subprocess.flowElements) {
  fe.$parent = subprocess;
}
```

---

## 10. Palette — Thêm nút vào thanh công cụ

### Pattern chuẩn

```typescript
export class MyPaletteProvider {
  static $inject = ['palette'];

  constructor(palette: BpmnPalette) {
    palette.registerProvider(/* priority */ 500, this);
  }

  getPaletteEntries(): Record<string, object> {
    return {
      'my-tool': {
        group:     'tools',           // nhóm trong palette
        className: 'my-icon-class',   // CSS class cho icon
        title:     'My Tool',         // tooltip
        action: {
          click(event: MouseEvent) {
            // xử lý click
          },
        },
      },

      // Separator
      'my-separator': {
        group:    'tools',
        type:     'separator',
      },
    };
  }
}
```

### Đăng ký trong module

```typescript
export const MyPaletteModule = {
  __init__: ['myPaletteProvider'],
  myPaletteProvider: ['type', MyPaletteProvider],
};
```

### Priority

Số càng cao → chạy sau → entries thêm vào sau. Default providers của bpmn-js dùng priority 1000.

### Mở popup từ palette

```typescript
// Palette provider có thêm popupMenu + canvas
static $inject = ['palette', 'popupMenu', 'canvas'];

getPaletteEntries() {
  const { popupMenu, canvas } = this;
  return {
    'my-more': {
      action: {
        click(e: MouseEvent) {
          popupMenu.open(
            canvas.getRootElement(),
            'my-popup-type',    // provider ID đã đăng ký
            { x: e.clientX, y: e.clientY },
          );
        },
      },
    },
  };
}
```

---

## 11. PopupMenu — Menu ngữ cảnh

### Đăng ký provider

```typescript
export class MyPopupProvider {
  static $inject = ['popupMenu'];

  constructor(popupMenu: BpmnPopupMenu) {
    popupMenu.registerProvider('my-popup-type', /* priority */ 1500, this);
  }

  // Body entries
  getPopupMenuEntries(): Record<string, object> {
    return {
      'action-1': {
        label:     'Do something',
        className: 'my-icon-class',
        title:     'Tooltip text',
        action() {
          // logic...
        },
      },

      // Disabled entry (dùng làm section header)
      '_header_section1': {
        label:     'SECTION NAME',
        className: 'my-section-header',
        disabled:  true,
        action() {},
      },
    };
  }

  // Header entries (luôn visible ở đầu popup)
  getPopupMenuHeaderEntries(): Record<string, object> {
    return {
      'import': {
        label:  'Import…',
        action() { /* ... */ },
      },
    };
  }
}
```

### Mở popup thủ công

```typescript
popupMenu.open(
  element,       // context element (hoặc canvas.getRootElement())
  'my-popup-type',
  { x: mouseX, y: mouseY },
);
```

### Section headers bằng disabled entries

```typescript
// CSS
const CSS = `
.djs-popup .entry.my-section-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #888;
  pointer-events: none;
  border-top: 1px solid rgba(0,0,0,0.09);
}
`;

// Inject CSS vào document
const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);
```

---

## 12. Custom Renderer — Thay đổi giao diện element

### Pattern A — Override hoàn toàn

```typescript
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { is } from 'bpmn-js/lib/util/ModelUtil';

const _Base = BaseRenderer as unknown as new (eventBus: unknown, priority: number) => {
  drawShape(parentNode: SVGGElement, element: unknown): SVGElement;
};

export class MyRenderer extends _Base {
  static $inject = ['eventBus'];

  constructor(eventBus: unknown) {
    super(eventBus, /* priority */ 1500); // > 1000 để override default
  }

  canRender(element: unknown): boolean {
    return is(element, 'bpmn:Task'); // chỉ handle Tasks
  }

  drawShape(parentNode: SVGGElement, element: unknown): SVGElement {
    // vẽ custom shape
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width',  String((element as any).width));
    rect.setAttribute('height', String((element as any).height));
    rect.setAttribute('fill',   '#4a90d9');
    parentNode.appendChild(rect);
    return rect;
  }
}
```

### Pattern B — Additive (let default render first, then augment)

```typescript
export class CustomBpmnRenderer extends _Base {
  static $inject = ['eventBus', 'bpmnRenderer'];

  constructor(eventBus: unknown, private readonly _bpmnRenderer: BpmnRendererService) {
    super(eventBus, 1500);
  }

  canRender(element: unknown): boolean {
    return !(element as any).labelTarget; // skip labels
  }

  drawShape(parentNode: SVGGElement, element: unknown): SVGElement {
    // 1. Let default renderer draw (preserves icons, markers)
    const shape = this._bpmnRenderer.drawShape(parentNode, element);

    // 2. Augment
    if (is(element, 'bpmn:Activity')) {
      const rect = parentNode.querySelector('rect') as SVGRectElement;
      if (rect) {
        rect.setAttribute('fill',   '#e3f2fd');
        rect.setAttribute('rx',     '8');
      }
      parentNode.classList.add('my-custom-activity');
    }

    return shape;
  }

  drawConnection(parentNode: SVGGElement, element: unknown): SVGElement {
    return this._bpmnRenderer.drawConnection(parentNode, element); // delegate
  }

  getShapePath(element: unknown): string {
    return this._bpmnRenderer.getShapePath(element); // delegate
  }
}
```

### Đăng ký module

```typescript
export const CustomRendererModule = {
  __init__: ['customBpmnRenderer'],
  customBpmnRenderer: ['type', CustomBpmnRenderer],
};
```

### Tại sao priority > 1000?

| Priority | Renderer |
|----------|---------|
| 1000 | bpmn-js default BpmnRenderer |
| 1500 | Custom renderer (runs first = higher priority in canRender check) |

---

## 13. DI Container — Đăng ký Plugin / Module

### Cấu trúc module

```typescript
export const MyModule = {
  // __init__: list services được khởi tạo ngay khi module load
  __init__: ['myService', 'myPaletteProvider'],

  // Đăng ký với 'type' → DI tạo instance từ class (singleton)
  myService:         ['type', MyService],
  myPaletteProvider: ['type', MyPaletteProvider],

  // Đăng ký với 'value' → inject giá trị cụ thể
  myConstant:        ['value', 42],

  // Đăng ký với 'factory' → tạo qua factory function
  myFactory:         ['factory', function(dep1: Dep1) { return new MyThing(dep1); }],
};
```

### static $inject

```typescript
class MyService {
  // Khai báo dependencies theo thứ tự constructor args
  static $inject = ['eventBus', 'canvas', 'config.myOption'];

  constructor(
    private readonly _eventBus: BpmnEventBus,
    private readonly _canvas:   BpmnCanvas,
    private readonly _option:   string | null,
  ) {}
}
```

**Quy tắc**: tên trong `$inject[]` phải khớp đúng với service name đã đăng ký.

### Lifecycle tự động

- Services trong `__init__` được tạo khi Modeler khởi động.
- Services **không** trong `__init__` được tạo lazy (khi được request lần đầu).
- Tất cả services là singleton trong scope của 1 Modeler instance.

### Truy cập service từ bên ngoài

```typescript
// Từ Modeler instance
const myService = modeler.get('myService') as MyService;

// Từ trong service khác (thông qua injector)
class OtherService {
  static $inject = ['injector'];
  constructor(private readonly _injector: BpmnInjector) {}

  doSomething() {
    const myService = this._injector.get('myService') as MyService;
  }
}
```

---

## 14. Config Injection — Truyền dữ liệu ngoài vào plugin

Cách inject objects từ ngoài bpmn-js vào trong plugin (không cần import trực tiếp).

### Khi tạo Modeler

```typescript
new Modeler({
  container: '#canvas',
  additionalModules: [MyPluginModule],

  // Bất kỳ key nào ở đây đều accessible qua 'config.keyName' trong DI
  myPluginOptions: {
    apiUrl:   'https://api.example.com',
    maxItems: 10,
  },
  subprocessSources: [new TabDiagramSource(tabManager)],
});
```

### Trong plugin nhận config

```typescript
class MyPlugin {
  static $inject = ['config.myPluginOptions', 'config.subprocessSources'];

  constructor(
    options:  { apiUrl: string; maxItems: number } | null,
    sources:  SubprocessSource[] | null,
  ) {
    this._options = options ?? { apiUrl: '', maxItems: 5 };
    this._sources = sources ?? [];
  }
}
```

**Lưu ý**: Nếu key không tồn tại trong config, DI inject `null` (không throw error).

### Pattern: Dependency Inversion qua config injection

```
Plugin:    SubprocessSource (interface) ← chỉ định nghĩa
Studio:    TabDiagramSource implements SubprocessSource ← implement
Config:    subprocessSources: [new TabDiagramSource(...)]
DI inject: 'config.subprocessSources' → plugin nhận mảng
```

Studio phụ thuộc vào Plugin (import interface), không phải ngược lại → đúng DIP.

---

## 15. moddle Types — Bảng tham chiếu

### Semantic layer (bpmn:*)

| Type | Mô tả | Thuộc tính quan trọng |
|------|-------|-----------------------|
| `bpmn:Definitions` | Root của file BPMN | `rootElements[]`, `diagrams[]` |
| `bpmn:Process` | Quy trình chính | `id`, `name`, `flowElements[]`, `isExecutable` |
| `bpmn:SubProcess` | Subprocess | `id`, `name`, `flowElements[]` |
| `bpmn:Task` | Task thông thường | `id`, `name` |
| `bpmn:UserTask` | User task | `id`, `name`, `assignee` |
| `bpmn:ServiceTask` | Service task | `id`, `name` |
| `bpmn:StartEvent` | Start event | `id`, `name` |
| `bpmn:EndEvent` | End event | `id`, `name` |
| `bpmn:SequenceFlow` | Connection | `id`, `sourceRef`, `targetRef` |
| `bpmn:ExtensionElements` | Container cho extensions | `values[]` |

### DI layer (bpmndi:* và dc:*)

| Type | Mô tả | Thuộc tính quan trọng |
|------|-------|-----------------------|
| `bpmndi:BPMNDiagram` | Diagram container | `id`, `plane` |
| `bpmndi:BPMNPlane` | Plane của diagram | `id`, `bpmnElement`, `planeElement[]` |
| `bpmndi:BPMNShape` | Shape trên canvas | `id`, `bpmnElement`, `bounds`, `isExpanded` |
| `bpmndi:BPMNEdge` | Edge (connection) | `id`, `bpmnElement`, `waypoint[]` |
| `dc:Bounds` | Vị trí và kích thước | `x`, `y`, `width`, `height` |
| `dc:Point` | Điểm waypoint | `x`, `y` |

### Extension layer (activiti:*, camunda:*)

| Type | Mô tả | Thuộc tính |
|------|-------|------------|
| `activiti:Properties` | Container properties | `values[]` |
| `activiti:Property` | Một property | `name`, `value` |

### Tạo đúng thứ tự khi merge XML

```typescript
// 1. Parse source XML → object tree
const { rootElement: sourceDefs } = await moddle.fromXML(sourceXml);

// 2. Tìm process nguồn
const sourceProcess = sourceDefs.rootElements
  .find(e => e.$type === 'bpmn:Process');

// 3. Tạo subprocess
const subProc = moddle.create('bpmn:SubProcess', { id: 'sp_1', name: 'Sub' });
subProc.flowElements = sourceProcess.flowElements ?? [];
subProc.$parent = currentProcess;     // QUAN TRỌNG: set $parent
currentProcess.flowElements.push(subProc);

// 4. Tạo outer shape (collapsed)
const shape = moddle.create('bpmndi:BPMNShape', {
  id: 'sp_1_di', bpmnElement: subProc, isExpanded: false,
});
shape.bounds = moddle.create('dc:Bounds', { x: 300, y: 200, width: 100, height: 80 });
currentDiagram.plane.planeElement.push(shape);

// 5. Tạo inner diagram (drill-down)
const innerPlane = moddle.create('bpmndi:BPMNPlane', {
  id: 'sp_1_plane', bpmnElement: subProc,
});
const innerDiagram = moddle.create('bpmndi:BPMNDiagram', { id: 'Diagram_sp_1' });
innerDiagram.plane = innerPlane;
currentDefs.diagrams.push(innerDiagram);

// 6. Serialize và re-import
const { xml } = await moddle.toXML(currentDefs, { format: true });
await modeler.importXML(xml);
```

---

## 16. Event Reference — Bảng sự kiện

### Built-in bpmn-js events

| Event | Payload | Khi nào fire |
|-------|---------|--------------|
| `selection.changed` | `{ newSelection: Element[], oldSelection: Element[] }` | User click / deselect element |
| `commandStack.changed` | `{}` | Sau bất kỳ command nào (kể cả undo/redo) |
| `element.changed` | `{ element: Element }` | Một element bị thay đổi (properties, position...) |
| `element.hover` | `{ element }` | Mouse hover trên element |
| `element.out` | `{ element }` | Mouse rời khỏi element |
| `element.click` | `{ element, originalEvent }` | Click trên element |
| `element.dblclick` | `{ element, originalEvent }` | Double click trên element |
| `canvas.viewbox.changing` | `{ viewbox }` | Đang zoom/scroll (nhiều lần) |
| `canvas.viewbox.changed` | `{ viewbox }` | Zoom/scroll đã xong |
| `diagram.init` | — | Diagram được khởi tạo |
| `diagram.destroy` | — | Diagram bị destroy |
| `import.done` | `{ warnings }` | Import XML xong |
| `shape.added` | `{ element }` | Shape được thêm |
| `shape.removed` | `{ element }` | Shape bị xóa |
| `connection.added` | `{ element }` | Connection được thêm |
| `connection.removed` | `{ element }` | Connection bị xóa |
| `palette.create` | — | Palette được tạo |
| `palette.changed` | — | Palette entries thay đổi |

### CommandStack events (theo command cụ thể)

Pattern: `commandStack.<command>.execute`, `commandStack.<command>.revert`

```typescript
eventBus.on('commandStack.shape.move.execute', (e) => {
  console.log('shape moved:', e.context);
});
eventBus.on('commandStack.element.updateProperties.execute', (e) => {
  console.log('properties updated:', e.context);
});
```

### Custom events (trong project này)

| Event | Payload | Dùng cho |
|-------|---------|---------|
| `subprocess.import-request` | — | Mở file picker để import BPMN |
| `subprocess.create` | `{ item: SubprocessItem }` | Place subprocess vào diagram |
| `subprocess.store.changed` | — | Store có thêm item mới |

### Khai báo custom event trong TypeScript

```typescript
// Trong BpmnEventBus interface
export interface BpmnEventBus {
  on(event: 'subprocess.create', callback: (e: { item: SubprocessItem }) => void): void;
  on(event: string, callback: (e: Record<string, unknown>) => void): void;
  // ...
}
```

---

## 17. Recipes — Công thức hoàn chỉnh

### Recipe 1: Tạo custom plugin đầy đủ

```typescript
// 1. Service
export class MyService {
  static $inject = ['eventBus', 'canvas'];

  constructor(
    private readonly _eventBus: BpmnEventBus,
    private readonly _canvas:   BpmnCanvas,
  ) {
    this._eventBus.on('element.click', (e) => {
      console.log('clicked:', (e as any).element?.id);
    });
  }

  doSomething(): void {
    this._canvas.zoom('fit-viewport');
  }
}

// 2. Module
export const MyModule = {
  __init__: ['myService'],
  myService: ['type', MyService],
};

// 3. Sử dụng
const modeler = new Modeler({
  container: '#canvas',
  additionalModules: [MyModule],
});

// 4. Truy cập từ ngoài
const svc = modeler.get('myService') as MyService;
svc.doSomething();
```

### Recipe 2: Lắng nghe selection và đọc properties

```typescript
const eventBus = modeler.get('eventBus') as BpmnEventBus;

eventBus.on('selection.changed', (e: SelectionChangedEvent) => {
  const [first] = e.newSelection;
  if (!first) {
    console.log('Nothing selected');
    return;
  }

  console.log('Selected:', {
    id:   first.id,
    type: first.type,
    name: first.businessObject?.name,
  });
});
```

### Recipe 3: Thêm Activiti custom property vào element

```typescript
const modeling  = modeler.get('modeling')  as BpmnModeling;
const moddle    = modeler.get('moddle')    as BpmnModdle;
const registry  = modeler.get('elementRegistry') as BpmnElementRegistry;

function setActivitiProperty(elementId: string, key: string, value: string): void {
  const element = registry.get(elementId);
  if (!element) return;

  const bo = element.businessObject;

  // Tạo hoặc tìm extensionElements
  let ext = bo.extensionElements as BpmnExtensionElements;
  if (!ext) {
    ext = moddle.create('bpmn:ExtensionElements', { values: [] });
  }

  // Tạo hoặc tìm activiti:Properties
  let propsEl = ext.values?.find(v => v.$type === 'activiti:Properties') as ActivitiProperties;
  if (!propsEl) {
    propsEl = moddle.create('activiti:Properties', { values: [] });
    ext.values = [...(ext.values ?? []), propsEl];
  }

  // Tìm hoặc tạo property
  const existing = propsEl.values?.find(p => p.name === key);
  if (existing) {
    (existing as ActivitiProperty).value = value;
  } else {
    const prop = moddle.create('activiti:Property', { name: key, value });
    propsEl.values = [...(propsEl.values ?? []), prop];
  }

  // Write-through via modeling (có undo)
  modeling.updateProperties(element as any, { extensionElements: ext });
}
```

### Recipe 4: Rename element qua properties panel + sync tab title

```typescript
// Trong studio / feature code
const eventBus = modeler.get('eventBus') as BpmnEventBus;
const canvas   = modeler.get('canvas')   as BpmnCanvas;

let _isSyncing = false;

// Tab rename → sync vào diagram
function onTabRenamed(tabId: string, newName: string): void {
  if (!isActiveTab(tabId)) return;
  _isSyncing = true;
  try {
    const root     = canvas.getRootElement();
    const modeling = modeler.get('modeling') as BpmnModeling;
    modeling.updateProperties(root as any, { name: newName });
  } finally {
    _isSyncing = false;
  }
}

// Diagram rename → sync vào tab
eventBus.on('element.changed', (e) => {
  if (_isSyncing) return;                        // guard: tránh echo loop
  const element = (e as any).element;
  if (!element) return;

  // Chỉ quan tâm root process
  if (element.id !== canvas.getRootElement().id) return;

  const newName = element.businessObject?.name;
  if (newName) {
    updateTabTitle(getActiveTabId(), newName);   // update tab UI
  }
});
```

### Recipe 5: Tạo collapsed SubProcess từ XML ngoài

```typescript
async function embedSubprocess(
  modeler: BpmnModelerExtender,
  sourceXml: string,
  name: string,
): Promise<void> {
  const moddle = modeler.moddle;

  // 1. Lưu trạng thái hiện tại
  const { xml: currentXml } = await modeler.saveXML({ format: false });

  // 2. Parse cả hai
  const { rootElement: currentDefs } = await moddle.fromXML(currentXml) as BpmnFromXmlResult;
  const { rootElement: sourceDefs }  = await moddle.fromXML(sourceXml)  as BpmnFromXmlResult;

  // 3. Prefix IDs để tránh collision
  const prefix = 'rsp' + Date.now().toString(36).slice(-5) + '_';
  remapIds(sourceDefs, prefix);

  // 4. Tìm source process
  const sourceProcess = sourceDefs.rootElements
    .find(e => e.$type === 'bpmn:Process') as BpmnProcess;

  // 5. Tạo SubProcess element
  const spId = prefix + 'sp';
  const subProc = moddle.create('bpmn:SubProcess', { id: spId, name });
  subProc.flowElements = sourceProcess.flowElements ?? [];
  for (const fe of subProc.flowElements) fe.$parent = subProc;

  // 6. Gắn vào current process
  const currentProcess = currentDefs.rootElements
    .find(e => e.$type === 'bpmn:Process') as BpmnProcess;
  subProc.$parent = currentProcess;
  currentProcess.flowElements.push(subProc);

  // 7. Shape ngoài (collapsed)
  const vb    = modeler.canvas.viewbox();
  const dropX = Math.round(vb.x + vb.width  / 2 - 50);
  const dropY = Math.round(vb.y + vb.height / 2 - 40);

  const outerShape = moddle.create('bpmndi:BPMNShape', {
    id: spId + '_di', bpmnElement: subProc, isExpanded: false,
  });
  outerShape.bounds = moddle.create('dc:Bounds', {
    x: dropX, y: dropY, width: 100, height: 80,
  });
  currentDefs.diagrams?.[0]?.plane?.planeElement?.push(outerShape);

  // 8. Inner diagram cho drill-down
  const innerPlane = moddle.create('bpmndi:BPMNPlane', {
    id: spId + '_plane', bpmnElement: subProc,
  });
  innerPlane.planeElement = sourceDefs.diagrams?.[0]?.plane?.planeElement ?? [];

  const innerDiagram = moddle.create('bpmndi:BPMNDiagram', { id: 'BPMNDiagram_' + spId });
  innerDiagram.plane = innerPlane;
  currentDefs.diagrams?.push(innerDiagram);

  // 9. Serialize và re-import
  const { xml: merged } = await moddle.toXML(currentDefs, { format: true });
  await modeler.importXML(merged);
  modeler.canvas.zoom('fit-viewport');
}
```

### Recipe 6: Custom Renderer với per-type màu sắc

```typescript
const COLORS: Record<string, { fill: string; stroke: string }> = {
  'bpmn:UserTask':    { fill: '#e8f4fd', stroke: '#2196f3' },
  'bpmn:ServiceTask': { fill: '#f3e5f5', stroke: '#9c27b0' },
  'bpmn:Task':        { fill: '#f1f8e9', stroke: '#4caf50' },
};

export class TypeColorRenderer extends _Base {
  static $inject = ['eventBus', 'bpmnRenderer'];

  constructor(eventBus: unknown, private readonly _base: BpmnRendererService) {
    super(eventBus, 1500);
  }

  canRender(element: unknown): boolean {
    return !!(element as any).type?.startsWith('bpmn:') && !(element as any).labelTarget;
  }

  drawShape(parentNode: SVGGElement, element: unknown): SVGElement {
    const shape = this._base.drawShape(parentNode, element);
    const type  = (element as any).type as string;
    const color = COLORS[type];
    if (color) {
      const rect = parentNode.querySelector('rect');
      if (rect) {
        rect.setAttribute('fill',   color.fill);
        rect.setAttribute('stroke', color.stroke);
      }
    }
    return shape;
  }

  drawConnection = this._base.drawConnection.bind(this._base);
  getShapePath   = this._base.getShapePath.bind(this._base);
}
```

### Recipe 7: Re-usable popup provider với sections

```typescript
type SectionDef = { key: string; label: string; items: ItemDef[] };
type ItemDef    = { id: string; label: string; action: () => void };

export class SectionedPopupProvider {
  static $inject = ['popupMenu'];

  private readonly _sections: SectionDef[] = [];

  constructor(popupMenu: BpmnPopupMenu) {
    popupMenu.registerProvider('my-sectioned-popup', 1500, this);
  }

  addSection(section: SectionDef): void {
    this._sections.push(section);
  }

  getPopupMenuEntries(): Record<string, object> {
    const entries: Record<string, object> = {};

    this._sections.forEach((section, idx) => {
      // Section header (disabled)
      entries[`_h_${section.key}`] = {
        label:     section.label,
        className: 'my-section-header' + (idx === 0 ? ' my-section-first' : ''),
        disabled:  true,
        action()   {},
      };

      if (section.items.length === 0) {
        entries[`_empty_${section.key}`] = {
          label: 'None', className: 'my-section-empty',
          disabled: true, action() {},
        };
        return;
      }

      section.items.forEach((item) => {
        const fn = item.action;
        entries[item.id] = { label: item.label, action() { fn(); } };
      });
    });

    return entries;
  }
}
```

---

## Tham khảo thêm

| Nguồn | Nội dung |
|-------|---------|
| [bpmn-js examples](https://github.com/bpmn-io/bpmn-js-examples) | Nhiều ví dụ chính thức |
| [diagram-js](https://github.com/bpmn-io/diagram-js) | Core của bpmn-js (canvas, DI, events) |
| [didi](https://github.com/nikku/didi) | DI container mà bpmn-js sử dụng |
| [bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) | Parse/serialize BPMN XML |
| [bpmn-js-properties-panel](https://github.com/bpmn-io/bpmn-js-properties-panel) | Properties panel chính thức |
| BPMN 2.0 spec | Schema đầy đủ cho tất cả types |
