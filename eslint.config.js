import js from '@eslint/js';
import pluginAstro from 'eslint-plugin-astro';
import pluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...pluginAstro.configs['flat/recommended'],
  // Sonar-equivalent rules (shift-left quality checks)
  {
    plugins: {
      unicorn: pluginUnicorn,
    },
    rules: {
      // S3358: Nested ternary operators
      'no-nested-ternary': 'warn',
      // S7735: Negated condition with else clause
      'no-negated-condition': 'warn',
      // S7781: Use replaceAll instead of replace with global regex
      'unicorn/prefer-string-replace-all': 'warn',
      // S1116: Empty statements
      'no-empty': 'warn',
      // S1186: Empty functions
      'no-empty-function': 'warn',
      // S1481: Unused local variables
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // S1854: Dead stores
      'no-unused-expressions': 'warn',
      // S3776: Cognitive complexity (approximated by max-depth)
      'max-depth': ['warn', 4],
      // S1117: Variable shadowing
      'no-shadow': 'warn',
      // S4144: Functions should not have identical implementations
      'no-dupe-else-if': 'error',
      // S1871: Branches should not have identical implementations
      'no-duplicate-case': 'error',
    },
  },
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
