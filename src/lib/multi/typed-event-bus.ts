// =============================================================================
// TypedEventBus — generic, fully-typed Observer / EventEmitter
//
// Design goals:
//   • Zero dependencies — pure TypeScript
//   • Compile-time safety: event names and payload types are enforced
//   • Returns an unsubscribe function from on() for easy cleanup
//   • Isolated error handling: one bad handler never blocks others
//   • Supports once() for one-shot subscriptions
// =============================================================================

type Handler<T> = (payload: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEventBus<TMap extends Record<string, any>> {
  private readonly _handlers = new Map<keyof TMap, Set<Handler<any>>>();

  // ── Subscribe ───────────────────────────────────────────────────────────────

  /**
   * Subscribe to an event.
   *
   * @returns An unsubscribe function — call it to remove the handler.
   *
   * @example
   * const unsub = bus.on('tab.activated', ({ next }) => console.log(next.title));
   * // later…
   * unsub();
   */
  on<K extends keyof TMap>(
    event:   K,
    handler: Handler<TMap[K]>,
  ): () => void {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event exactly once.
   * The handler is automatically removed after the first invocation.
   */
  once<K extends keyof TMap>(
    event:   K,
    handler: Handler<TMap[K]>,
  ): () => void {
    const wrapper: Handler<TMap[K]> = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  // ── Unsubscribe ─────────────────────────────────────────────────────────────

  /** Remove a specific handler for an event. */
  off<K extends keyof TMap>(
    event:   K,
    handler: Handler<TMap[K]>,
  ): void {
    this._handlers.get(event)?.delete(handler);
  }

  // ── Publish ─────────────────────────────────────────────────────────────────

  /**
   * Emit an event, invoking all registered handlers.
   * Errors thrown by individual handlers are caught and logged so that one
   * bad handler never prevents others from running.
   */
  emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
    const handlers = this._handlers.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        console.error(
          `[TypedEventBus] Uncaught error in handler for "${String(event)}":`,
          err,
        );
      }
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  /** Remove all handlers for a specific event, or every event if omitted. */
  clear(event?: keyof TMap): void {
    if (event !== undefined) {
      this._handlers.delete(event);
    } else {
      this._handlers.clear();
    }
  }

  /** Returns the number of handlers currently registered for an event. */
  listenerCount(event: keyof TMap): number {
    return this._handlers.get(event)?.size ?? 0;
  }
}
