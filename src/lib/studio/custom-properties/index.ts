import { CustomPropertiesProvider } from './custom-properties-provider.js';

export { CustomPropertiesProvider };

export const CustomPropertiesModule: { [key: string]: unknown } = {
  __init__: ['customPropertiesProvider'],
  customPropertiesProvider: ['type', CustomPropertiesProvider],
};
