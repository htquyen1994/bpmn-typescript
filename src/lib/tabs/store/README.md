# Pluggable Tab Store

Kiến trúc lưu trữ dữ liệu tab theo mô hình Strategy — backend có thể thay đổi mà không ảnh hưởng đến business logic.

---

## Vấn đề cần giải quyết

Khi mở nhiều diagram lớn, toàn bộ XML nằm trong JavaScript heap → tốn RAM → garbage collector hoạt động nhiều → UI giật.

Ngoài ra, có các nhu cầu khác nhau tuỳ ngữ cảnh:
- **Dev/demo**: Cần nhanh, không cần persist.
- **Ứng dụng thực tế**: Cần persist qua page reload.
- **Diagram lớn (>1MB mỗi file)**: Cần async I/O, không block main thread.
- **Hệ thống có server**: Cần lưu lên backend qua API.

→ Không có một giải pháp nào phù hợp tất cả. Cần kiến trúc **pluggable**.

---

## Kiến trúc

```
AbstractTabStore (abstract class)
│
├── MemoryTabStore        → RAM (Map<id, xml>)
├── LocalStorageTabStore  → localStorage (key: prefix:xml:id)
├── IndexedDBTabStore     → IndexedDB (object store: 'tab-xml')
└── [Tuỳ chỉnh]          → API, SQLite (WASM), SharedArrayBuffer...
```

### Phân tách trách nhiệm

| Loại dữ liệu | Lưu ở | Lý do |
|-------------|-------|-------|
| Metadata (title, isDirty, lifecycle, viewbox) | **Luôn trong Memory** | Cần đọc instant để render UI |
| XML content | **Backend tuỳ chọn** | Có thể MB, không cần luôn có trong RAM |

`_order[]` và `_activeId` nằm trong `AbstractTabStore` base class — mọi implementation đều dùng chung logic ordering, chỉ khác ở nơi lưu XML.

---

## Design Patterns

### 1. Strategy Pattern

> **Mục đích**: Tách thuật toán (cách lưu dữ liệu) ra khỏi context (TabManager) sử dụng nó.

```typescript
// Context — không quan tâm concrete strategy
class TabManager {
  constructor(config: TabManagerConfig, store?: AbstractTabStore) {
    this._store = store ?? new MemoryTabStore(); // default strategy
  }
}

// Thay strategy tại runtime hoặc construction time
const manager = new TabManager({}, new IndexedDBTabStore('my-app'));
```

**So sánh với Interface (TypeScript)**:

`AbstractTabStore` là **abstract class** thay vì interface vì:
1. Chứa **shared state** (`_order`, `_activeId`) — interface không có state.
2. Chứa **concrete methods** (`getAdjacentTo`, `move`, `indexOf`) — logic dùng chung cho tất cả implementations.
3. Interface chỉ định nghĩa contract, abstract class có thể partial implementation.

```typescript
// Subclass chỉ cần implement phần khác nhau (XML storage)
// Phần giống nhau (ordering, active pointer) đã có trong base class
class MyCustomStore extends AbstractTabStore {
  add(meta: TabMeta): void { ... }
  async saveXml(id: string, xml: string): Promise<void> { ... }
  // getAdjacentTo, move, indexOf — thừa kế từ base
}
```

### 2. Template Method Pattern (trong AbstractTabStore)

> **Mục đích**: Định nghĩa skeleton của một algorithm trong base class, để subclass fill vào các bước cụ thể.

`AbstractTabStore` định nghĩa flow: sync metadata ops + async XML ops. Subclass chỉ implement các bước khác nhau giữa các backends.

---

## So sánh các Implementations

| | MemoryTabStore | LocalStorageTabStore | IndexedDBTabStore |
|--|--|--|--|
| **Tốc độ đọc** | Instant | ~1ms (sync) | ~5-20ms (async) |
| **Tốc độ ghi** | Instant | ~1ms | ~5-20ms |
| **Persist** | ❌ Mất khi reload | ✅ Tồn tại | ✅ Tồn tại |
| **Giới hạn size** | RAM heap | ~5MB tổng | Không giới hạn |
| **Thread** | Main | Main (blocking) | Main (non-blocking) |
| **API** | Sync + Async wrap | Sync + Async wrap | Truly Async |
| **Use case** | Dev, demo, test | Ứng dụng nhỏ | Production, file lớn |

---

## Kỹ thuật: IndexedDB

### Tại sao IndexedDB tốt hơn localStorage cho file lớn

```
localStorage:
- Synchronous → block main thread khi đọc/ghi file lớn
- Limit 5MB tổng → quota exceeded với vài diagram lớn
- String only → XML string fit nhưng không efficient

IndexedDB:
- Asynchronous → không block UI
- Gigabytes → không lo quota
- Structured clone → có thể lưu ArrayBuffer, Blob (dùng cho binary format sau này)
```

### Wrapper Promise cho IDB Request

IndexedDB dùng callback pattern cũ (IDBRequest.onsuccess/onerror). Cần wrap thành Promise để dùng async/await:

```typescript
private _request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// Sử dụng
const result = await this._request(store.get(id));
```

### Transaction trong IndexedDB

Mỗi lần đọc/ghi phải tạo transaction mới. Transaction có scope (readonly/readwrite) và tự đóng sau khi hoàn thành:

```typescript
private async _store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await this._dbReady;
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}
```

---

## Kỹ thuật: LocalStorage

### Fallback mechanism

Khi localStorage đầy (QuotaExceededError), store fallback về in-memory cache:

```typescript
async saveXml(id: string, xml: string): Promise<void> {
  try {
    localStorage.setItem(this._key(id), xml);
    this._cache.delete(id); // Thành công → xoá fallback cache
  } catch (err) {
    // QuotaExceededError → giữ trong memory
    this._cache.set(id, xml);
  }
}
```

**Tại sao quan trọng**: Ứng dụng vẫn hoạt động bình thường, chỉ mất tính persist — tốt hơn crash.

---

## Cách thêm Backend mới

```typescript
// Ví dụ: API backend
export class ApiTabStore extends AbstractTabStore {
  private readonly _map = new Map<string, TabMeta>();

  add(meta: TabMeta): void {
    this._map.set(meta.id, meta);
    this._order.push(meta.id);
  }

  // ... các sync methods khác ...

  async saveXml(id: string, xml: string): Promise<void> {
    await fetch(`/api/diagrams/${id}`, {
      method: 'PUT',
      body: xml,
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  async loadXml(id: string): Promise<string> {
    const res = await fetch(`/api/diagrams/${id}`);
    return res.text();
  }

  async removeXml(id: string): Promise<void> {
    await fetch(`/api/diagrams/${id}`, { method: 'DELETE' });
  }
}

// Sử dụng
const manager = new TabManager({}, new ApiTabStore());
```

---

## Vấn đề hiện tại & Giải pháp tương lai

### ❌ Metadata không được persist
**Vấn đề**: Tab order, titles, isDirty trạng thái đều mất khi reload (kể cả `LocalStorageTabStore` và `IndexedDBTabStore`).

**Giải pháp**: Thêm method `serializeMeta() / restoreMeta()` vào abstract class. Hoặc tách ra `MetaStore` riêng (localStorage là đủ vì metadata nhỏ).

---

### ❌ Không có versioning/migration cho IndexedDB schema
**Vấn đề**: `DB_VERSION = 1`. Nếu sau này cần thay đổi schema (thêm column, index...) → user cũ bị vỡ.

**Giải pháp**: Implement `onupgradeneeded` với version check:
```typescript
req.onupgradeneeded = (e) => {
  const db  = req.result;
  const old = e.oldVersion;
  if (old < 1) db.createObjectStore('tab-xml');
  if (old < 2) db.createObjectStore('tab-meta'); // migration v2
};
```

---

### ❌ Không có error boundary cho async operations
**Vấn đề**: `saveXml` và `loadXml` có thể reject. `TabManager` dùng `void store.removeXml()` (fire-and-forget) → silent failure.

**Giải pháp**: `AbstractTabStore` nên emit error events, hoặc `TabManager` wrap các async calls với retry logic + user notification.

---

### ❌ Không có cache invalidation cho IndexedDB
**Vấn đề**: Nếu tab XML được modified ở tab browser khác (multi-tab scenario), data trong memory sẽ stale.

**Giải pháp**: Dùng `BroadcastChannel` API để thông báo giữa các tab browser:
```typescript
const channel = new BroadcastChannel('csp-bpmn-store');
channel.onmessage = (e) => {
  if (e.data.type === 'xml-updated' && e.data.id === currentId) {
    // Reload từ IDB
  }
};
```
