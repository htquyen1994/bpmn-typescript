# Reusable Subprocess Plugin

Plugin cho phép người dùng import BPMN diagram và đặt lại như một collapsed subprocess trong diagram hiện tại.

---

## Cấu trúc

```
reusable-subprocess/
├── subprocess-source.ts          # Interface mở rộng (extension point)
├── subprocess-store.ts           # In-memory store cho imported items
├── subprocess-palette-provider.ts # Palette button
├── subprocess-popup-provider.ts  # Popup menu với grouped sections
├── subprocess-creator.ts         # XML merge algorithm
└── index.ts                      # DI module + exports
```

---

## Kiến trúc tổng quan

```
User click palette button
    │
    ▼
SubprocessPaletteProvider
    │ (nếu có items)
    ▼
popup.open('reusable-subprocess', ...)
    │
    ▼
SubprocessPopupProvider.getPopupMenuEntries()
    ├── Section "Imported SubProcesses" ← SubprocessStore.getAll()
    └── Section "Open Diagrams"         ← TabDiagramSource.getItems()
              │
              ▼ User click item
    eventBus.fire('subprocess.create', { item })
              │
              ▼
    Studio._handleSubprocessCreate(item)
              ├── item.resolveXml?.()  ← lazy load XML nếu là tab source
              └── SubprocessCreator.createFromItem()
```

---

## bpmn-js Plugin Architecture

### Dependency Injection (IoC Container)

bpmn-js có DI container riêng (dựa trên [didi](https://github.com/nikku/didi)). Mỗi service được đăng ký với:
- `'type'` → tạo instance từ class (singleton trong scope của modeler)
- `'value'` → inject giá trị cụ thể
- `'factory'` → tạo qua factory function

```typescript
export const ReusableSubprocessModule = {
  __init__: ['subprocessStore', 'subprocessPaletteProvider', 'subprocessPopupProvider'],
  subprocessStore:           ['type', SubprocessStore],           // DI tạo instance
  subprocessPaletteProvider: ['type', SubprocessPaletteProvider], // DI tạo instance
  subprocessPopupProvider:   ['type', SubprocessPopupProvider],   // DI tạo instance
};
```

### Static `$inject` Property

```typescript
class SubprocessStore {
  static $inject = ['eventBus']; // DI inject 'eventBus' vào arg đầu tiên của constructor
}
```

Đây là convention của didi DI — khai báo dependencies bằng string array tương ứng với constructor arguments.

### Config Injection

```typescript
class SubprocessPopupProvider {
  static $inject = [
    'popupMenu', 'subprocessStore', 'eventBus', 'canvas',
    'config.subprocessSources', // ← inject từ Modeler config
  ];
}
```

Khi tạo Modeler:
```typescript
new Modeler({
  subprocessSources: [new TabDiagramSource(tabManager)],
  //                  ↑ accessible via 'config.subprocessSources' trong DI
})
```

Đây là cách inject external dependencies (nằm ngoài bpmn-js) vào trong plugin.

---

## Design Patterns

### 1. Plugin Pattern (bpmn-js Provider)

bpmn-js dùng Provider pattern cho palette và popup menu:

```typescript
// Register provider
palette.registerProvider(priority: number, provider: object): void;
popupMenu.registerProvider(type: string, priority: number, provider: object): void;

// Provider interface (duck typing — không cần implements keyword)
interface PaletteProvider {
  getPaletteEntries(): Record<string, PaletteEntry>;
}

interface PopupMenuProvider {
  getPopupMenuEntries(): Record<string, PopupMenuEntry>;
  getPopupMenuHeaderEntries(): Record<string, PopupMenuEntry>;
}
```

Khi bpmn-js cần hiển thị palette/popup, nó gọi `getPopupMenuEntries()` trên tất cả registered providers và merge kết quả.

### 2. Dependency Inversion Principle — `SubprocessSource`

**Vấn đề**: `SubprocessPopupProvider` (plugin) muốn hiển thị items từ `TabManager` (studio-level) — nhưng plugin không nên biết về Studio hay TabManager.

**Giải pháp**: Định nghĩa interface `SubprocessSource` trong plugin:
```typescript
// Plugin định nghĩa abstraction (interface)
interface SubprocessSource {
  readonly label: string;
  getItems(): SubprocessItem[];
}
```

Studio implement:
```typescript
// Studio implement concrete class (chi tiết)
class TabDiagramSource implements SubprocessSource { ... }
```

Plugin nhận qua config injection (không import trực tiếp):
```typescript
constructor(..., extraSources: SubprocessSource[] | null) {
  this._extraSources = extraSources ?? [];
}
```

```
Plugin layer:     SubprocessSource (interface)    ← chỉ định nghĩa
Studio layer:     TabDiagramSource implements SubprocessSource ← implement
```

Dependency flow đúng: **Studio phụ thuộc vào Plugin** (import interface từ plugin), không phải ngược lại.

### 3. Open/Closed Principle

`SubprocessPopupProvider` **đóng** với modification (không sửa code), nhưng **mở** để extension:

```typescript
// Thêm source mới mà không sửa PopupProvider:
new Modeler({
  subprocessSources: [
    new TabDiagramSource(tabManager),
    new LibrarySource(apiClient),     // source mới
    new TemplateSource(templateRepo), // source mới
  ]
})
```

### 4. Lazy Loading — `resolveXml`

```typescript
interface SubprocessItem {
  xml:         string;             // eager: dùng ngay
  resolveXml?: () => Promise<string>; // lazy: fetch khi cần
}
```

**Tại sao cần lazy loading**: `TabDiagramSource.getItems()` được gọi **mỗi khi popup mở**. Nếu load XML cho 10 tabs × 500KB = 5MB mỗi lần popup mở → tệ.

Với `resolveXml`, XML chỉ được load khi user **click** để place item:
```typescript
// Studio handler
const resolvedItem = item.resolveXml
  ? { ...item, xml: await item.resolveXml() } // chỉ load khi cần
  : item;
```

---

## XML Merge Algorithm (SubprocessCreator)

9 bước để nhúng một diagram vào diagram khác như collapsed subprocess:

```
1. Export current diagram XML (modeler.saveXML)
2. Parse both XMLs (via bpmn-moddle)
3. ID remapping — prefix tất cả IDs để tránh collision
4. Create bpmn:SubProcess element
5. Copy flowElements từ source process vào subprocess
6. Attach subprocess vào current process
7. Create BPMNShape (outer collapsed shape, 100×80px)
8. Create BPMNDiagram + BPMNPlane (inner drill-down diagram)
9. Re-import merged XML vào modeler
```

### Tại sao cần ID remapping?

BPMN IDs phải unique trong toàn file. Khi merge 2 files:
- Source file: `id="Task_1"`, `id="StartEvent_1"`
- Target file: đã có `id="Task_1"` → conflict!

**Giải pháp**: Prefix tất cả IDs trong source:
```
"Task_1" → "rsp3a9x_Task_1"
```

Prefix format: `'rsp' + Date.now().toString(36).slice(-5) + '_'` → unique per import.

---

## Grouped Popup Menu (UX)

```
┌─────────────────────────────────┐
│ [Import XML…]                   │ ← header (luôn visible)
├─────────────────────────────────┤
│ IMPORTED SUBPROCESSES           │ ← section header (disabled entry)
│   ▸ Order Process               │
│   ▸ Payment Flow                │
├─────────────────────────────────┤
│ OPEN DIAGRAMS                   │ ← section header
│   ▸ Diagram 2                   │
│   None                          │ (nếu trống)
└─────────────────────────────────┘
```

Section headers là **disabled entries** với custom CSS class — cách an toàn nhất để tạo visual separator mà không cần biết internals của bpmn-js popup rendering.

```typescript
entries[`_h_${key}`] = {
  label:     'Imported SubProcesses',
  className: 'csp-popup-sp-section-header',
  disabled:  true,
  action() {},
};
```

CSS được inject từ constructor:
```css
.djs-popup .entry.csp-popup-sp-section-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  /* ... */
}
```

---

## Vấn đề hiện tại & Giải pháp tương lai

### ❌ `getItems()` phải synchronous
**Vấn đề**: `SubprocessSource.getItems()` là sync — không thể fetch items từ API.

**Giải pháp**: Thay đổi interface thành async + preload:
```typescript
interface SubprocessSource {
  readonly label: string;
  preload?(): Promise<void>;     // gọi khi popup sắp mở (preload data)
  getItems(): SubprocessItem[];  // sync sau khi preload xong
}
```

Hoặc toàn bộ async:
```typescript
getItems(): Promise<SubprocessItem[]>;
```
Nhưng cần `PopupProvider` async-aware.

---

### ❌ Không có search/filter trong popup
**Vấn đề**: Nhiều stored items → khó tìm.

**Giải pháp**: bpmn-js popup menu có hỗ trợ search built-in (bpmn-js 15+). Thêm `search: true` vào popup config khi `open()`. Hoặc tự implement search bằng custom header input.

---

### ❌ Không có preview khi hover
**Vấn đề**: User không biết item trông như thế nào trước khi place.

**Giải pháp**: Render SVG thumbnail trong tooltip khi hover. Dùng `bpmn-js NavigatedViewer` để render thumbnail:
```typescript
const viewer = new NavigatedViewer({ container: offscreenDiv });
await viewer.importXML(item.xml);
const { svg } = await viewer.saveSVG();
// Hiển thị svg trong tooltip
```

---

### ❌ Import từ file mỗi lần mở app
**Vấn đề**: Imported SubProcesses không persist → mỗi lần reload phải import lại.

**Giải pháp**: `SubprocessStore` nên tích hợp với `LocalStorageTabStore` để persist danh sách:
```typescript
class PersistentSubprocessStore extends SubprocessStore {
  constructor(eventBus: BpmnEventBus) {
    super(eventBus);
    this._loadFromStorage();
  }

  override add(item: SubprocessItem): void {
    super.add(item);
    this._saveToStorage();
  }
}
```

---

### ❌ `TabDiagramSource` chỉ show tabs lifecycle === 'ready' | 'idle'
**Vấn đề**: Tabs đang 'loading' không show → user bối rối nếu tab vừa được mở mà chưa load xong.

**Giải pháp**: Show 'loading' tabs với disabled state và message "Loading...":
```typescript
entries[`sp-${tabId}`] = {
  label:    tab.title,
  disabled: tab.lifecycle === 'loading',
  title:    tab.lifecycle === 'loading' ? 'Diagram is still loading…' : `Place "${tab.title}"`,
  // ...
};
```
