import js from '@eslint/js';
import pluginAstro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...pluginAstro.configs['flat/recommended'],
  // Default: browser globals for frontend code
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  // Astro files parsing
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: await import('astro-eslint-parser'),
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {},
  },
  // Node scripts (CI/build utilities)
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
    },
  },
  // Ignore generated/build output
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
