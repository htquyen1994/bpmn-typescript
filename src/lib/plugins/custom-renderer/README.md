# Custom BPMN Renderer

## Mục tiêu

Tạo trải nghiệm giao diện khác biệt cho diagram bpmn-js: mỗi loại task có màu riêng, bo góc như thẻ card, đổ bóng, và icon palette được tô màu theo loại — mà không cần thay đổi file XML hay cấu trúc BPMN.

---

## Phân tích khó khăn ban đầu

### 1. CSS-only không đủ

Cách tiếp cận đầu tiên là thêm class CSS vào container và override màu sắc:

```css
.csp-theme-modern .djs-shape .djs-visual > rect {
  fill: #dbeafe;
  stroke: #3b82f6;
}
```

**Vấn đề:** Tất cả các task đều cùng màu — không phân biệt được UserTask, ServiceTask, ScriptTask... Hơn nữa, bpmn-js render shape bằng **SVG presentation attributes** (`fill="white"`, `stroke="black"` trực tiếp trên element), và mặc dù CSS có thể override chúng (specificity 0), ta không có cách nào biết được loại task từ selector CSS một mình.

### 2. Không có TypeScript types cho internal APIs

bpmn-js không ship TypeScript types cho:

- `diagram-js/lib/draw/BaseRenderer`
- `tiny-svg` (thư viện SVG utility của bpmn-js)
- `bpmn-js/lib/util/ModelUtil` (hàm `is()` để check BPMN type hierarchy)

→ Cần tự định nghĩa trong `vendor.d.ts`.

### 3. Extend class JavaScript không có types trong TypeScript

`BaseRenderer` là class JS thuần, không có types. Không thể viết thẳng:

```typescript
class MyRenderer extends BaseRenderer { ... }  // TS error
```

---

## Hướng giải quyết

### Bước 1: Hiểu hệ thống priority của bpmn-js

bpmn-js/diagram-js sử dụng **event-driven rendering**. Khi cần vẽ một shape, nó fire event `render.shape`. Tất cả renderer đã đăng ký đều được xét theo priority — renderer có priority cao nhất và `canRender()` trả về `true` sẽ được gọi.

| Renderer | Priority |
|---|---|
| `BpmnRenderer` (mặc định) | 1000 |
| **`CustomBpmnRenderer`** (của ta) | **1500** |

Priority cao hơn → chạy trước → ta có toàn quyền quyết định cách render.

### Bước 2: Pattern B — Additive rendering (không thay thế, mà bổ sung)

Thay vì tự vẽ lại toàn bộ shape (sẽ mất hết icon task như người dùng, bánh răng, phong bì...), ta dùng pattern **additive**:

```typescript
drawShape(parentNode, element) {
  // 1. Để BpmnRenderer vẽ trước — giữ nguyên icon, marker, label
  const shape = this._bpmnRenderer.drawShape(parentNode, element);

  // 2. Augment: chỉnh màu, bo góc, thêm shadow class
  this._enhanceActivity(parentNode, element);

  return shape;
}
```

Ưu điểm:
- Giữ nguyên tất cả icon task-type (bpmn-font glyphs)
- Giữ nguyên BPMN markers (loop, parallel, sequential)
- Giữ nguyên semantics của stroke-width (end event dùng stroke-width=7 để biểu thị "termination")

### Bước 3: Extend untyped JS class trong TypeScript

```typescript
// Cast to a typed constructor signature before extending
const _Base = BaseRenderer as unknown as new (
  eventBus: unknown,
  priority: number,
) => {
  drawShape(parentNode: SVGGElement, element: unknown): SVGElement;
  drawConnection(parentNode: SVGGElement, element: unknown): SVGElement;
  getShapePath(element: unknown): string;
};

export class CustomBpmnRenderer extends _Base {
  static $inject = ['eventBus', 'bpmnRenderer'];
  // ...
}
```

Pattern: `as unknown as Constructor` — đây là cách TypeScript-safe nhất để extend class JS không có types, không dùng `any`.

### Bước 4: Dependency Injection với bpmn-js DI system

bpmn-js dùng DI container riêng (không phải Angular hay Inversify). Services được inject qua static array `$inject`:

```typescript
static $inject = ['eventBus', 'bpmnRenderer'];

constructor(eventBus: unknown, bpmnRenderer: BpmnRendererService) {
  super(eventBus, PRIORITY);  // BaseRenderer cần eventBus để đăng ký
  this._bpmnRenderer = bpmnRenderer;
}
```

Đăng ký module:

```typescript
export const CustomRendererModule = {
  __init__: ['customBpmnRenderer'],         // khởi tạo ngay khi modeler start
  customBpmnRenderer: ['type', CustomBpmnRenderer],  // DI token → class
};
```

### Bước 5: Phân loại BPMN type với `is()` và type hierarchy

BPMN có hierarchy: `bpmn:UserTask` → `bpmn:Task` → `bpmn:Activity` → ...

Hàm `is(element, 'bpmn:Activity')` traverse hierarchy này — trả về `true` cho UserTask, ServiceTask, SubProcess, CallActivity, v.v. Không cần check từng type một.

```typescript
if (is(element, 'bpmn:Activity')) { ... }
else if (is(element, 'bpmn:Event')) { ... }
else if (is(element, 'bpmn:Gateway')) { ... }
```

### Bước 6: SVG manipulation với tiny-svg

bpmn-js dùng `tiny-svg` — wrapper nhỏ quanh SVG DOM API:

```typescript
import { attr as svgAttr, query as svgQuery } from 'tiny-svg';

// Tìm phần tử đầu tiên trong group
const rect = svgQuery('rect', parentNode);

// Set SVG presentation attributes
svgAttr(rect, { fill: '#dbeafe', stroke: '#3b82f6', rx: 10 });
```

**Tại sao không dùng `element.style.fill`?**
SVG shapes dùng *presentation attributes* (không phải CSS properties). `svgAttr()` set đúng cách này. CSS có thể override với specificity > 0, còn presentation attributes có specificity = 0.

### Bước 7: Drop shadow qua CSS filter, không thêm DOM node

Để tạo shadow kiểu card, có hai cách:

**Cách 1 (không dùng):** Thêm một `<rect>` shadow vào SVG DOM trước main rect. Phức tạp, cần xử lý deduplication, và bị diagram-js clear giữa các render cycles.

**Cách 2 (đang dùng):** Thêm CSS class vào `.djs-visual` group và dùng CSS `filter: drop-shadow()`:

```typescript
parentNode.classList.add('csp-r-activity');
```

```css
.djs-visual.csp-r-activity {
  filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.18));
}
```

Ưu điểm: clean, không thêm DOM node, browser tự handle rendering.

---

## Kiến trúc kết quả

```
src/lib/plugins/custom-renderer/
├── element-colors.ts        # Per-type color map cho activities, events, gateways
├── custom-bpmn-renderer.ts  # Renderer class (extends BaseRenderer, priority 1500)
├── renderer-styles.css      # CSS: drop-shadow + palette icon colours
├── index.ts                 # DI module + CSS export
└── README.md                # (file này)
```

Module được add vào `additionalModules` trong cả **Modeler** (edit mode) và **NavigatedViewer** (view mode):

```typescript
// In csp-bpmn-studio.ts
additionalModules: [..., CustomRendererModule]
```

CSS được inject qua `addStyles('bpmn-custom-renderer', RENDERER_CSS)` — cùng pattern với minimap và theme styles.

---

## Kỹ thuật quan trọng cần nhớ

| Kỹ thuật | Tại sao quan trọng |
|---|---|
| `canRender(el) { return !el.labelTarget; }` | Không intercept label shapes — bpmn-js quản lý labels riêng |
| `static $inject = [...]` | DI contract — thứ tự array = thứ tự tham số constructor |
| `super(eventBus, PRIORITY)` | BaseRenderer cần eventBus để đăng ký với rendering pipeline |
| `bpmnRenderer.drawShape(...)` trực tiếp | Gọi method của service, không qua event system → bypass priority |
| Preserve `stroke-width` trên circle | End event dùng stroke-width=7 để biểu thị termination — semantic quan trọng |
| `filter: drop-shadow()` trên SVG group | SVG filter áp dụng cho toàn bộ painted region của group |

---

## Mở rộng sau này

- **Per-element color override:** Lưu màu custom vào `businessObject` extension attributes, đọc trong `getActivityColors(element.businessObject)`.
- **Animated transitions:** CSS `transition: fill 0.2s ease` — tuy nhiên SVG presentation attributes không hỗ trợ CSS transitions; cần chuyển sang dùng `svgAttr` + CSS variables.
- **Dark mode:** Thêm bộ màu thứ hai và toggle tương tự `DiagramThemeManager`.
- **Custom icons:** Thay thế bpmn-font bằng SVG icons — cần override phần render icon trong `drawShape`, tìm và xóa path của icon cũ, append SVG icon mới.
