/**
 * Abstract base class for BPMN Web Components.
 *
 * Provides:
 *  - A `ready` Promise resolved by calling `this.readyResolve()` inside `onConnect()`.
 *  - An idempotent `addStyles(id, css)` helper for injecting CSS into the document.
 *  - Abstract lifecycle hooks `onConnect` / `onDisconnect` that subclasses must implement.
 */
export abstract class BaseComponent extends HTMLElement {
  /** Resolves when the component has fully initialised. */
  readonly ready: Promise<void>;

  protected readyResolve!: () => void;
  protected readyReject!: (err: Error) => void;

  constructor() {
    super();
    this.ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  connectedCallback(): void {
    this.onConnect();
  }

  disconnectedCallback(): void {
    this.onDisconnect();
  }

  /** Called when the element is inserted into the DOM. Must call `this.readyResolve()` when done. */
  protected abstract onConnect(): void;

  /** Called when the element is removed from the DOM. */
  protected abstract onDisconnect(): void;

  /**
   * Injects a `<style>` tag into `document.head` exactly once (keyed by `id`).
   * Safe to call multiple times — subsequent calls with the same `id` are no-ops.
   */
  protected addStyles(id: string, css: string): void {
    if (document.head.querySelector(`style[data-csp-id="${id}"]`)) return;
    const style = document.createElement('style');
    style.setAttribute('data-csp-id', id);
    style.textContent = css;
    document.head.appendChild(style);
  }
}
