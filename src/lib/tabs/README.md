# Tab Management System

Hệ thống quản lý nhiều diagram đồng thời theo mô hình tab (giống Excel/VSCode).

---

## Cấu trúc

```
src/lib/tabs/
├── types.ts              # Kiểu dữ liệu dùng chung
├── typed-event-bus.ts    # Event emitter có type-safe
├── tab-manager.ts        # Điều phối toàn bộ tab operations
├── tab-store.ts          # Compat shim (deprecated → store/)
├── store/                # Pluggable storage backends
│   ├── abstract-tab-store.ts
│   ├── memory-tab-store.ts
│   ├── local-storage-tab-store.ts
│   └── indexed-db-tab-store.ts
└── tab-bar/              # UI renderer
```

---

## Design Patterns

### 1. Mediator Pattern — `TabManager`

> **Định nghĩa**: Một object trung gian kiểm soát giao tiếp giữa các object khác, tránh các object phụ thuộc trực tiếp vào nhau.

**Áp dụng**: `TabManager` là mediator duy nhất. `TabBarUI`, facade, studio đều chỉ nói chuyện với `TabManager` — không bao giờ trực tiếp gọi `AbstractTabStore` hay `TypedEventBus`.

```
TabBarUI ──┐
Studio   ──┼──► TabManager ──► AbstractTabStore (data)
Facade   ──┘         └──────► TypedEventBus    (events)
```

**Lợi ích**: Thêm một consumer mới (ví dụ breadcrumb, status bar) không cần sửa store hay event bus — chỉ cần subscribe vào `manager.events`.

---

### 2. Repository Pattern — `AbstractTabStore`

> **Định nghĩa**: Tầng trừu tượng giữa business logic và data access, che giấu nơi dữ liệu thực sự được lưu trữ.

**Áp dụng**: `TabManager` không biết XML được lưu ở RAM, localStorage hay IndexedDB. Nó chỉ gọi `store.saveXml()` / `store.loadXml()`.

```typescript
// TabManager không quan tâm backend
await this._store.saveXml(id, xml);   // có thể là RAM, LS, IDB, hay API
const xml = await this._store.loadXml(id);
```

**Chi tiết**: Xem `store/README.md`.

---

### 3. Strategy Pattern — Pluggable Store

> **Định nghĩa**: Định nghĩa một family of algorithms, đóng gói từng cái, và làm chúng hoán đổi được.

**Áp dụng**: `AbstractTabStore` là interface của strategy. `MemoryTabStore`, `LocalStorageTabStore`, `IndexedDBTabStore` là các concrete strategies. Truyền vào `TabManager` constructor.

```typescript
// Strategy được inject tại construction time
const manager = new TabManager({}, new IndexedDBTabStore('my-app'));
```

---

### 4. Observer Pattern — `TypedEventBus`

> **Định nghĩa**: Khi một object thay đổi trạng thái, tất cả các object đang phụ thuộc vào nó đều được thông báo tự động.

**Áp dụng**: Mọi mutation trong `TabManager` đều emit event. `TabBarUI` subscribe và re-render. Studio subscribe để xử lý business logic.

```typescript
manager.events.on('tab.activated', ({ prev, next }) => { ... });
manager.events.on('tab.dirtied',   ({ tab }) => { ... });
```

**TypeScript nâng cao**: `TypedEventBus<TMap>` dùng generic để đảm bảo event name và payload type khớp nhau tại compile time:
```typescript
// Compiler báo lỗi nếu dùng sai tên event hoặc sai type payload
events.on('tab.activated', ({ next }) => next.title); // ✓
events.on('tab.typo',      () => {});                 // ✗ Compile error
```

---

## Tách biệt `TabMeta` và `DiagramTabState`

### Vấn đề gốc
`DiagramTabState` ban đầu chứa cả `xml: string` — với nhiều tab lớn → nhiều MB trong RAM.

### Giải pháp

| Type | Chứa | Lý do |
|------|------|-------|
| `TabMeta` | id, title, isDirty, lifecycle, viewbox, metadata | Nhẹ, luôn trong memory, dùng cho UI |
| `DiagramTabState extends TabMeta` | + `xml: string` | Chỉ dùng khi cần full XML |

**Tab bar** chỉ cần `TabMeta` → `getAll()` trả về `TabMeta[]` (instant).

**Khi switch tab** → `await tabManager.loadXml(id)` → store backend fetch XML.

---

## Lifecycle của một Tab

```
add()        activate()       importXML()      markDirty()
  │               │               │                │
idle ────────► loading ──────► ready ──────────► dirty
                  │               │
                  └──── error ◄───┘  (nếu importXML thất bại)
```

---

## Kiến thức liên quan

| Khái niệm | Mô tả |
|-----------|-------|
| **Inversion of Control (IoC)** | `TabManager` nhận store qua constructor, không tự tạo |
| **Dependency Injection** | `new TabManager({}, store)` — store được inject |
| **SOLID — Open/Closed** | Thêm backend mới không sửa `TabManager` |
| **SOLID — Dependency Inversion** | `TabManager` phụ thuộc vào abstraction (`AbstractTabStore`), không phải concrete class |
| **Immutable fields** | `id`, `index`, `createdAt` là `readonly` — không thể sửa sau khi tạo |
| **Fire-and-forget** | `void store.saveXml()` khi add tab với initial XML — không block UI |

---

## Vấn đề hiện tại & Giải pháp tương lai

### ❌ Không có session restore
**Vấn đề**: Refresh trang → mất toàn bộ tabs (với `MemoryTabStore`).

**Giải pháp**: Implement `SessionTabStore` kết hợp `LocalStorageTabStore` lưu order + activeId, `IndexedDBTabStore` lưu XML. Khi init, `TabManager` có thể nhận `initialTabs?: TabMeta[]` để restore.

---

### ❌ Không có undo khi đóng tab
**Vấn đề**: User nhỡ tay close tab → mất hết.

**Giải pháp**: `TabManager.remove()` nên trả về một `RestoreToken` — giữ lại tab state trong một `undoStack` giới hạn (ví dụ 5 tabs gần nhất đã đóng).

---

### ❌ Race condition khi switch tab nhanh
**Vấn đề**: User click tab A → tab B rất nhanh → hai `_switchToTab` chạy concurrently. Flag `_switching` chỉ block re-entry, không queue.

**Giải pháp**: Dùng một `_pendingSwitch: string | null` để lưu ID của switch cuối cùng. Khi switch kết thúc, kiểm tra nếu `_pendingSwitch !== currentId` thì tiếp tục switch tiếp.

---

### ❌ `getAll()` re-renders toàn bộ tab bar
**Vấn đề**: Mỗi event (`tab.dirtied`, `tab.updated`...) đều gọi `_render()` → `innerHTML = ''` → tạo lại toàn bộ DOM.

**Giải pháp**: Implement reconciliation đơn giản — so sánh tab list cũ và mới, chỉ patch các element thay đổi (tương tự Virtual DOM diff nhưng thủ công).

---

### ❌ Không có maxAge / eviction cho tab XML
**Vấn đề**: `LocalStorageTabStore` có thể đầy. `MemoryTabStore` giữ XML của tất cả tabs mãi mãi.

**Giải pháp**: Thêm LRU (Least Recently Used) cache trong store — tab không active quá N phút sẽ bị evict khỏi memory, reload từ backend khi cần.
