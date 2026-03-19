import type { IPropertyRenderer } from './factory.js';
import type { CustomPropertyConfig, TextPropertyConfig } from '../types.js';

export class TextRenderer implements IPropertyRenderer {
  render(
    config: CustomPropertyConfig,
    value: unknown,
    onChange: (v: unknown) => void,
    onBlur: () => void,
  ): HTMLElement {
    const cfg = config as TextPropertyConfig;
    const wrapper = document.createElement('div');
    wrapper.className = 'cpp-field';

    const strValue = value != null ? String(value) : '';

    if (cfg.multiline) {
      const ta = document.createElement('textarea');
      ta.className = 'cpp-input cpp-textarea';
      ta.placeholder = cfg.placeholder ?? '';
      ta.value = strValue;
      ta.rows = 3;
      ta.addEventListener('input', () => onChange(ta.value));
      ta.addEventListener('blur', onBlur);
      wrapper.appendChild(ta);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cpp-input';
      input.placeholder = cfg.placeholder ?? '';
      input.value = strValue;
      input.addEventListener('input', () => onChange(input.value));
      input.addEventListener('blur', onBlur);
      wrapper.appendChild(input);
    }

    return wrapper;
  }
}
