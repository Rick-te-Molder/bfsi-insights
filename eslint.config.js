import js from '@eslint/js';
import pluginAstro from 'eslint-plugin-astro';

export default [
  js.configs.recommended,
  ...pluginAstro.configs['flat/recommended'],
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: await import('astro-eslint-parser'),
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
    },
    rules: {},
  },
];
