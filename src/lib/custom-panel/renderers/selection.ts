import type { IPropertyRenderer } from './factory.js';
import type {
  CustomPropertyConfig,
  SelectionPropertyConfig,
  SelectOption,
} from '../types.js';

export class SelectionRenderer implements IPropertyRenderer {
  render(
    config: CustomPropertyConfig,
    value: unknown,
    onChange: (v: unknown) => void,
    onBlur: () => void,
  ): HTMLElement {
    const cfg = config as SelectionPropertyConfig;

    const wrapper = document.createElement('div');
    wrapper.className = 'cpp-field';

    const select = document.createElement('select');
    select.className = 'cpp-select';
    select.disabled = true; // enabled once options are loaded

    // Placeholder option (always first, non-selectable)
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = cfg.placeholder ?? '— select —';
    placeholderOpt.disabled = true;
    select.appendChild(placeholderOpt);

    // Loading sentinel — removed once real options arrive
    const loadingOpt = document.createElement('option');
    loadingOpt.value = '__loading__';
    loadingOpt.textContent = 'Loading…';
    loadingOpt.disabled = true;
    select.appendChild(loadingOpt);

    const populate = (options: SelectOption[]) => {
      loadingOpt.remove();

      for (const opt of options) {
        const el = document.createElement('option');
        el.value = opt.value;
        el.textContent = opt.label;
        select.appendChild(el);
      }

      // Restore previously stored value
      const stored = value != null ? String(value) : '';
      select.value = stored || '';
      select.disabled = false;
    };

    // Resolve options: static array | sync fn | async fn
    const src = cfg.options;
    if (Array.isArray(src)) {
      populate(src);
    } else {
      try {
        const result = (src as () => SelectOption[] | Promise<SelectOption[]>)();
        if (result instanceof Promise) {
          result
            .then(populate)
            .catch(() => {
              loadingOpt.textContent = 'Failed to load options';
            });
        } else {
          populate(result);
        }
      } catch {
        loadingOpt.textContent = 'Failed to load options';
      }
    }

    select.addEventListener('change', () => {
      onChange(select.value || null);
    });
    select.addEventListener('blur', onBlur);

    wrapper.appendChild(select);
    return wrapper;
  }
}
