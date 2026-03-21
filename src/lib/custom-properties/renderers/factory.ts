import type { PropertyType, CustomPropertyConfig } from '../types.js';

// ── Renderer interface ────────────────────────────────────────────────────────

/**
 * Contract every property renderer must satisfy.
 * Implement this interface and call `PropertyRendererFactory.register()` to
 * support a new property type without modifying existing code (Open/Closed).
 */
export interface IPropertyRenderer {
  /**
   * Build and return the root DOM element for this field.
   *
   * @param config   Full property configuration.
   * @param value    Current stored value (may be undefined on first render).
   * @param onChange Called immediately when the user changes the field value.
   * @param onBlur   Called when the field loses focus — used to trigger validation.
   */
  render(
    config: CustomPropertyConfig,
    value: unknown,
    onChange: (v: unknown) => void,
    onBlur: () => void,
  ): HTMLElement;
}

// ── Factory / Registry ────────────────────────────────────────────────────────

/**
 * Factory pattern — maps PropertyType strings to IPropertyRenderer instances.
 *
 * Built-in renderers (text, checkbox, selection) are registered in
 * `src/lib/custom-properties/renderers/index.ts`. Consumers can register
 * additional renderers for custom types before mounting the panel.
 *
 * @example
 * PropertyRendererFactory.register('rating', new StarRatingRenderer());
 */
export class PropertyRendererFactory {
  private static readonly registry = new Map<string, IPropertyRenderer>();

  /** Register (or replace) the renderer for a given type string. */
  static register(type: PropertyType | string, renderer: IPropertyRenderer): void {
    this.registry.set(type, renderer);
  }

  /**
   * Retrieve the renderer for a given type.
   * @throws if no renderer is registered for the type.
   */
  static get(type: PropertyType | string): IPropertyRenderer {
    const renderer = this.registry.get(type);
    if (!renderer) {
      throw new Error(
        `[csp-bpmn] No renderer registered for property type "${type}". ` +
        `Call PropertyRendererFactory.register("${type}", renderer) to add one.`,
      );
    }
    return renderer;
  }

  static has(type: PropertyType | string): boolean {
    return this.registry.has(type);
  }
}
