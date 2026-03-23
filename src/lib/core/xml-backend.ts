// =============================================================================
// AbstractXmlBackend — pluggable XML storage strategy
//
// Shared by SubprocessStore and (optionally) custom TabStore implementations.
// Separates heavy BPMN XML blobs from lightweight metadata so in-memory Maps
// only hold small objects; the actual XML lives in the chosen backend.
//
// Built-in implementations:
//   MemoryXmlBackend         — JavaScript Map, zero I/O, zero persistence
//   (IndexedDBXmlBackend and LocalStorageXmlBackend can be added per Phase 2)
// =============================================================================

/**
 * Pluggable storage strategy for raw BPMN XML blobs.
 * Implement this interface to change where subprocess XML is persisted.
 */
export abstract class AbstractXmlBackend {
  abstract saveXml(id: string, xml: string): Promise<void>;
  abstract loadXml(id: string): Promise<string>;
  abstract removeXml(id: string): Promise<void>;
  /** Called on teardown. Override to release resources (DB connections, etc.). */
  dispose(): void {}
}

/**
 * Default backend — stores XML in a JavaScript Map.
 *
 * Zero I/O, zero dependencies, no persistence across page reloads.
 * Suitable for development and for applications where subprocess items
 * are always re-imported from the server or from file.
 */
export class MemoryXmlBackend extends AbstractXmlBackend {
  private readonly _cache = new Map<string, string>();

  async saveXml(id: string, xml: string): Promise<void> {
    this._cache.set(id, xml);
  }

  async loadXml(id: string): Promise<string> {
    return this._cache.get(id) ?? '';
  }

  async removeXml(id: string): Promise<void> {
    this._cache.delete(id);
  }

  override dispose(): void {
    this._cache.clear();
  }
}
