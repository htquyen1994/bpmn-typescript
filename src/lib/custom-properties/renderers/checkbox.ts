import type { IPropertyRenderer } from './factory.js';
import type { CustomPropertyConfig, CheckboxPropertyConfig } from '../types.js';

export class CheckboxRenderer implements IPropertyRenderer {
  render(
    config: CustomPropertyConfig,
    value: unknown,
    onChange: (v: unknown) => void,
    onBlur: () => void,
  ): HTMLElement {
    const cfg = config as CheckboxPropertyConfig;

    // For checkbox the label is embedded inside the renderer,
    // so the panel skips rendering a separate <span class="cpp-label">.
    const wrapper = document.createElement('div');
    wrapper.className = 'cpp-field cpp-field--checkbox';

    const label = document.createElement('label');
    label.className = 'cpp-checkbox-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cpp-checkbox';
    checkbox.checked = Boolean(value ?? cfg.defaultValue ?? false);

    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
      onBlur(); // validate immediately on toggle
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${cfg.label}`));
    wrapper.appendChild(label);

    return wrapper;
  }
}
