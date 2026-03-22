# Tab Bar UI

Component hiển thị thanh tab ở dưới cùng, cho phép người dùng switch, rename, đóng diagram.

---

## Cấu trúc File

```
tab-bar/
├── tab-bar.html       # Shell: wrapper + list container + add button
├── tab-bar-item.html  # Template: cấu trúc một tab (dirty dot + label + close)
├── tab-bar.css        # Toàn bộ styles (không có style inline trong JS)
├── tab-bar-ui.ts      # Logic: render, event wiring, inline rename
└── index.ts           # Public exports
```

**Nguyên tắc tách file**: Mỗi file chỉ có một trách nhiệm.

| File | Trách nhiệm | Không chứa |
|------|-------------|------------|
| `.html` | Structure (skeleton) | Style, logic |
| `.css` | Presentation | Structure, logic |
| `.ts` | Behavior | Inline style, hardcoded HTML string |

---

## Design Patterns

### 1. Template Method Pattern — `UIComponent` base class

> **Mục đích**: Base class định nghĩa skeleton của một algorithm (lifecycle), subclass fill vào các bước cụ thể.

```
UIComponent (abstract)
├── mount(parent)    → [_build()] → append → [_onMounted()]
├── destroy()        → cleanups → remove root
│
└── Template methods:
    ├── _build()     ← ABSTRACT — subclass phải implement
    └── _onMounted() ← optional hook — subclass override nếu cần
```

`TabBarUI` extends `UIComponent`:
- `_build()` → parse HTML templates, wire add button
- `_onMounted()` → inject CSS, subscribe events, initial render

### 2. Flyweight Pattern — Template Cloning

> **Mục đích**: Chia sẻ một object "template" để tạo ra nhiều objects giống nhau, tránh tạo lại từ đầu mỗi lần.

**Áp dụng**: `_itemTemplate` được parse **một lần** trong `_build()`. Mỗi tab được tạo bằng `cloneNode(true)` — nhanh hơn gọi `createElement` + `appendChild` nhiều lần:

```typescript
// Parse 1 lần
this._itemTemplate = tpl.firstElementChild as HTMLElement;

// Clone N lần (mỗi tab)
const el = this._itemTemplate.cloneNode(true) as HTMLElement;
```

**Lưu ý quan trọng**: `cloneNode(true)` chỉ clone cấu trúc DOM và attributes — **không** clone event listeners. Event listeners được gắn thủ công sau mỗi clone → không bị memory leak kiểu "clone-and-forget".

### 3. Observer Pattern — Event Subscription

`TabBarUI` subscribe vào `TabManager.events` để re-render khi dữ liệu thay đổi. Dùng `addCleanup()` để tự động unsubscribe khi component bị destroy:

```typescript
for (const ev of ['tab.added', 'tab.removed', ...] as const) {
  this.addCleanup(this._manager.events.on(ev, re));
}
// Khi destroy() được gọi → tất cả cleanup fns chạy → unsubscribe
```

---

## Kỹ thuật HTML

### Import HTML Template với Vite `?raw`

```typescript
// @ts-ignore – Vite ?raw resolves at build time
import shellHtml from './tab-bar.html?raw';
```

Vite biến file `.html` thành một string constant tại build time. Không có HTTP request lúc runtime.

**`?inline` vs `?raw`**:

| Suffix | Dùng cho | Output |
|--------|----------|--------|
| `?inline` | CSS | String (content của file CSS) |
| `?raw` | HTML, text | String (content nguyên văn) |

### Parse và sử dụng HTML template

```typescript
const wrapper = document.createElement('div');
wrapper.innerHTML = (shellHtml as string).trim();
const root = wrapper.firstElementChild as HTMLElement;
```

**Tại sao dùng wrapper div?** `innerHTML` gán vào một container → có thể parse nhiều root elements. `firstElementChild` lấy element thực sự cần.

**Lưu ý bảo mật**: `innerHTML` chỉ an toàn khi template string đến từ source code (bundled tại build time), không từ user input. Với dynamic content như tab titles, luôn dùng `textContent` (không parse HTML).

---

## Kỹ thuật CSS

### Class-driven Dirty Dot (không dùng DOM insertion)

**Cũ (tạo/xoá DOM node)**:
```typescript
if (tab.isDirty) {
  const dot = document.createElement('span');
  dot.className = 'csp-tab-dirty';
  el.appendChild(dot);
}
```

**Mới (toggle CSS class)**:
```css
.csp-tab-dirty              { display: none; }
.csp-tab--dirty .csp-tab-dirty { display: block; }
```
```typescript
el.classList.toggle('csp-tab--dirty', tab.isDirty);
```

**Tại sao tốt hơn**:
- Dirty dot luôn có trong DOM (từ template) → không trigger browser layout khi toggle
- CSS transition có thể applied (ví dụ fade in/out dot)
- Logic TypeScript đơn giản hơn (1 dòng thay vì 4 dòng)

### BEM-like Naming Convention

```
.csp-tab           ← Block (component gốc)
.csp-tab--active   ← Modifier (trạng thái active)
.csp-tab--dirty    ← Modifier (trạng thái dirty)
.csp-tab-label     ← Element (con của block)
.csp-tab-close     ← Element (con của block)
.csp-tab-dirty     ← Element (con của block, tên trùng với modifier class cha)
```

**Lưu ý**: `.csp-tab-dirty` (element) khác với `.csp-tab--dirty` (modifier trên parent). Đây là pattern phổ biến để CSS có thể control element dựa trên trạng thái parent.

---

## Inline Rename

Double-click tab label → inline rename với `<input>`:

```
[span.csp-tab-label "Diagram 1"]  → dblclick →
[input[value="Diagram 1"]]       → Enter/blur → commit
                                 → Escape    → revert
```

**Kỹ thuật**: `labelEl.replaceWith(input)` thay thế span bằng input tại chỗ trong DOM. Khi commit, `input.replaceWith(labelEl)` đảo lại. Không tạo/xoá nhiều elements — chỉ swap references.

---

## Accessibility (ARIA)

Các attributes được set trên tab elements:

```html
<div role="tablist">               <!-- list container -->
  <div role="tab"
       aria-selected="true"        <!-- active tab -->
       tabindex="0">               <!-- focusable khi active -->
    <span aria-hidden="true">      <!-- dirty dot - ẩn với screen reader -->
    <button aria-label="Close..."> <!-- meaningful label -->
```

**Tại sao quan trọng**: Screen reader users cần biết tab nào đang active, close button làm gì.

---

## Vấn đề hiện tại & Giải pháp tương lai

### ❌ Full re-render mỗi khi có bất kỳ event nào

**Vấn đề**: `tab.dirtied` → `_render()` → `innerHTML = ''` → tạo lại toàn bộ tab DOM. Với 20+ tabs → 20+ cloneNode + addEventListener mỗi lần một tab dirty.

**Giải pháp**: Implement keyed reconciliation:
```typescript
private _reconcile(tabs: TabMeta[], activeId: string | null): void {
  const existing = new Map(
    [...this._list.children].map(el => [
      (el as HTMLElement).dataset.tabId!, el as HTMLElement
    ])
  );

  for (const tab of tabs) {
    if (existing.has(tab.id)) {
      this._patchTabEl(existing.get(tab.id)!, tab, tab.id === activeId);
      existing.delete(tab.id);
    } else {
      this._list.appendChild(this._createTabEl(tab, tab.id === activeId));
    }
  }
  // Remove tabs that no longer exist
  for (const el of existing.values()) el.remove();
}
```

---

### ❌ Không có drag-to-reorder UI
**Vấn đề**: `TabManager.move()` đã có, nhưng UI chưa implement drag.

**Giải pháp**: Dùng HTML5 Drag and Drop API hoặc Pointer Events:
```typescript
el.draggable = true;
el.addEventListener('dragstart', (e) => { e.dataTransfer!.setData('text', tab.id); });
this._list.addEventListener('dragover', (e) => { /* reorder preview */ });
this._list.addEventListener('drop', (e) => {
  const fromId = e.dataTransfer!.getData('text');
  const toIndex = /* calculate from drop position */;
  this._cb.onMove(fromId, toIndex);
});
```

---

### ❌ Inline rename không có validation
**Vấn đề**: Người dùng có thể nhập tên trống (bị fallback về old title), nhưng không có visual feedback.

**Giải pháp**: Thêm border-color validation và error message nhỏ:
```typescript
input.addEventListener('input', () => {
  input.style.outlineColor = input.value.trim() ? '#4a90d9' : '#e53935';
});
```

---

### ❌ Close button luôn hiển thị khi tab active (dễ nhỡ tay)
**Vấn đề**: Với active tab, close button luôn thấy → người dùng có thể vô tình click.

**Giải pháp**: Chỉ show close button khi hover, hoặc thêm confirmation dialog khi tab dirty.
