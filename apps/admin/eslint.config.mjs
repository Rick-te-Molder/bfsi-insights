import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import pluginReact from 'eslint-plugin-react';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Sonar-equivalent rules for React (shift-left quality checks)
  {
    plugins: {
      react: pluginReact,
    },
    rules: {
      // S6479: Array index as React key
      'react/no-array-index-key': 'warn',
      // S6759: React props should be read-only (advisory - TypeScript handles this)
      // Note: TypeScript's Readonly<> is preferred, this is just awareness
      // S3358: Nested ternary operators
      'no-nested-ternary': 'warn',
      // S7735: Negated condition with else clause
      'no-negated-condition': 'warn',
      // S1116: Empty statements
      'no-empty': 'warn',
      // S3776: Cognitive complexity (approximated by max-depth)
      'max-depth': ['warn', 4],
      // S1117: Variable shadowing
      'no-shadow': 'off', // Handled by @typescript-eslint/no-shadow
      '@typescript-eslint/no-shadow': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Additional build/coverage artifacts:
    'coverage/**',
    'lcov-report/**',
    'dist/**',
    '.turbo/**',
    '.vercel/**',
  ]),
  // Custom rules
  {
    rules: {
      // Allow underscore-prefixed unused variables (intentionally unused)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Disable overly strict set-state-in-effect check (our async data fetching pattern is safe)
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);

export default eslintConfig;
