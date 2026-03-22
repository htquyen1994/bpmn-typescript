# Loading Overlay

Component overlay hiển thị spinner toàn màn hình, dùng chung cho nhiều tính năng không đồng bộ.

---

## Vấn đề cần giải quyết

Khi switch diagram tab với file lớn, UI bị "đóng băng" mà không có phản hồi trực quan → người dùng không biết app đang xử lý hay bị treo.

Yêu cầu:
1. Hiện spinner trong khi load XML (switch tab, place subprocess...)
2. Nhiều tính năng khác nhau có thể sử dụng (không chỉ mỗi switch tab)
3. Có thể bật/tắt từ bất kỳ đâu (Studio facade, plugin, feature code...)
4. Các caller độc lập — caller A show không ảnh hưởng đến caller B hide

---

## Cấu trúc

```
loading/
├── loading-overlay.ts   # Component logic + CSS injection
├── loading-overlay.css  # Animation và layout
└── index.ts             # Public export
```

---

## Design Patterns

### 1. Reference Counting Pattern

> **Định nghĩa**: Theo dõi số lượng references đang active đến một resource. Resource chỉ được release khi count về 0.

**Vấn đề nếu không có Reference Counting**:
```
Caller A: show()  ← depth = 1 ✓
Caller B: show()  ← depth = 1 (vẫn ✓ nếu có ref count)
Caller A: hide()  ← depth = 0 → HIDDEN ← Caller B vẫn đang loading! ✗
```

**Với Reference Counting**:
```
show() → depth++ → depth = 1 → visible
show() → depth++ → depth = 2 → still visible
hide() → depth-- → depth = 1 → still visible
hide() → depth-- → depth = 0 → hidden ✓
```

```typescript
show(message = ''): void {
  this._depth++;
  this._sync();
}

hide(): void {
  this._depth = Math.max(0, this._depth - 1); // clamp at 0
  this._sync();
}
```

`Math.max(0, ...)` là safety guard — tránh depth âm nếu caller gọi `hide()` nhiều lần.

**So sánh với Singleton**: Loading overlay là một instance (không phải singleton global), được inject vào nơi cần — linh hoạt hơn singleton khi có nhiều isolated contexts (ví dụ: nhiều web component trên cùng trang).

---

### 2. CSS-driven State (không dùng JavaScript để show/hide)

Thay vì `element.style.display = 'none'`, dùng CSS class toggle:

```css
.csp-loading-overlay           { opacity: 0; pointer-events: none; }
.csp-loading-overlay--visible  { opacity: 1; pointer-events: all;  }
```

```typescript
private _sync(): void {
  const visible = this._depth > 0;
  this._root.classList.toggle('csp-loading-overlay--visible', visible);
  this._root.setAttribute('aria-hidden', String(!visible));
}
```

**Lợi ích**:
- CSS `transition: opacity 180ms ease` → smooth fade in/out tự động
- Không bị FOUC (Flash of Unstyled Content) vì `opacity: 0` ngay từ đầu
- Dễ customize qua CSS variables mà không cần sửa TypeScript

---

### 3. Lazy Mount (không tạo DOM trước khi mount)

```typescript
mount(container: Element): void {
  if (this._root) return; // idempotent — safe to call nhiều lần
  this._injectStyles(container.ownerDocument ?? document);
  // ... tạo DOM ...
  container.append(this._root);
}
```

DOM chỉ được tạo khi `mount()` được gọi — không tốn resource nếu overlay không bao giờ được dùng.

**`if (this._root) return`**: Idempotent call — gọi `mount()` nhiều lần không tạo nhiều overlays.

---

## Kỹ thuật CSS

### CSS Custom Properties (Variables) cho theming

```css
.csp-loading-overlay {
  background: var(--csp-loading-bg, rgba(0, 0, 0, 0.30));
}
.csp-loading-spinner {
  border-top-color: var(--csp-loading-color, #ffffff);
}
```

Người dùng library có thể override:
```css
:root {
  --csp-loading-bg:    rgba(255, 255, 255, 0.8); /* light theme */
  --csp-loading-color: #1976d2;                   /* blue spinner */
}
```

### Spinner Animation

```css
@keyframes csp-spin {
  to { transform: rotate(360deg); }
}
.csp-loading-spinner {
  border:           3px solid var(--csp-loading-track, rgba(255,255,255,0.20));
  border-top-color: var(--csp-loading-color, #ffffff);
  border-radius:    50%;
  animation:        csp-spin 0.65s linear infinite;
}
```

Chỉ border-top-color khác màu với 3 cạnh còn lại → tạo hiệu ứng spinner với pure CSS, không cần SVG hay image.

### `backdrop-filter: blur(2px)`

```css
.csp-loading-overlay {
  backdrop-filter: blur(2px);
}
```

Làm mờ content phía sau overlay — cho người dùng biết có content bên dưới nhưng đang disabled.

**Lưu ý**: Không được hỗ trợ bởi một số browser cũ. Nhưng là progressive enhancement — không có nó overlay vẫn hoạt động, chỉ mất hiệu ứng blur.

### `pointer-events: none` khi hidden

```css
.csp-loading-overlay { pointer-events: none; } /* hidden: click-through */
.csp-loading-overlay--visible { pointer-events: all; } /* visible: block clicks */
```

Khi overlay ẩn (opacity: 0), vẫn tồn tại trong DOM. Nếu không có `pointer-events: none`, nó sẽ chặn click events của content bên dưới → bug không thể tương tác với UI khi overlay ẩn.

---

## Accessibility

```typescript
this._root.setAttribute('role', 'status');
this._root.setAttribute('aria-live', 'polite');
this._root.setAttribute('aria-hidden', 'true');  // visible: 'false'
```

| Attribute | Giá trị | Ý nghĩa |
|-----------|---------|---------|
| `role="status"` | — | Screen reader biết đây là live region |
| `aria-live="polite"` | — | Không interrupt, đọc khi screen reader rảnh |
| `aria-hidden` | `true`/`false` | Ẩn/hiện với screen reader khi overlay ẩn/hiện |

---

## Cách sử dụng từ nơi khác

```typescript
// Trong Studio: đã mounted tại _buildLayout()
this._loadingOverlay.mount(this._layout.canvasContainer);

// Switch tab
this._loadingOverlay.show('Switching diagram…');
try {
  await doWork();
} finally {
  this._loadingOverlay.hide(); // luôn hide dù có lỗi
}

// Nested usage (safe nhờ ref counting)
this._loadingOverlay.show('Placing SubProcess…');
// ... bên trong có thể show/hide lần nữa ...
this._loadingOverlay.hide();

// Force hide (error recovery)
this._loadingOverlay.forceHide();
```

---

## Vấn đề hiện tại & Giải pháp tương lai

### ❌ Không có progress indicator
**Vấn đề**: Spinner không cho người dùng biết còn bao lâu → anxiety-inducing với file rất lớn.

**Giải pháp**: Thêm `setProgress(percent: number)` và progress bar:
```typescript
setProgress(percent: number): void {
  this._progressEl.style.width = `${Math.min(100, percent)}%`;
  this._progressEl.hidden = false;
}
```

---

### ❌ Không có timeout/auto-hide
**Vấn đề**: Nếu code bị lỗi mà không gọi `hide()`, overlay bị kẹt mãi → app unusable.

**Giải pháp**: `show(message, timeoutMs?)` — tự động hide sau timeout:
```typescript
show(message = '', timeoutMs?: number): void {
  this._depth++;
  if (timeoutMs) {
    const timer = setTimeout(() => { this._depth--; this._sync(); }, timeoutMs);
    this._timers.push(timer);
  }
  this._sync();
}
```

---

### ❌ Message không có animation khi thay đổi
**Vấn đề**: `setMessage('Step 2 of 3')` thay text đột ngột, không smooth.

**Giải pháp**: Fade out → đổi text → fade in:
```typescript
setMessage(message: string): void {
  this._msgEl.style.opacity = '0';
  setTimeout(() => {
    this._msgEl.textContent = message;
    this._msgEl.style.opacity = '1';
  }, 150);
}
```

---

### ❌ Chỉ mount được 1 container
**Vấn đề**: `mount()` bị idempotent lock — không thể mount trên cả canvas lẫn properties panel.

**Giải pháp**: Thay vì một instance, dùng factory:
```typescript
class LoadingOverlay {
  static create(container: Element): LoadingOverlay {
    const instance = new LoadingOverlay();
    instance.mount(container);
    return instance;
  }
}
```
