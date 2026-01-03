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
    files: ['scripts/**/*.mjs', 'scripts/**/*.js', 'scripts/**/*.cjs'],
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
  // Agent API backend (Node.js)
  {
    files: ['services/agent-api/**/*.js'],
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
  // Ignore generated/build output, types, and archived scripts
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'test-results/**',
      'reports/**',
      'node_modules/**',
      '.astro/**',
      '**/*.d.ts',
      'scripts/_archive/**',
    ],
  },
];
