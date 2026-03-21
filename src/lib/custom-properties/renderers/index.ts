// Register built-in renderers as a side-effect of importing this module.
import { PropertyRendererFactory } from './factory.js';
import { TextRenderer }            from './text.js';
import { CheckboxRenderer }        from './checkbox.js';
import { SelectionRenderer }       from './selection.js';

PropertyRendererFactory.register('text',      new TextRenderer());
PropertyRendererFactory.register('checkbox',  new CheckboxRenderer());
PropertyRendererFactory.register('selection', new SelectionRenderer());

export { PropertyRendererFactory } from './factory.js';
export type { IPropertyRenderer }  from './factory.js';
