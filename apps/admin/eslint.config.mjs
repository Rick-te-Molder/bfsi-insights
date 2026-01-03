import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
