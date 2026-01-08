# Use export...from for Re-exports

## Rule

S7763 - Re-exports should use "export...from" syntax

## Problem

Importing a module only to immediately re-export it creates unnecessary intermediate variables:

```javascript
import defaultExport from './foo.js';
export default defaultExport; // Noncompliant

import { namedExport } from './bar.js';
export { namedExport }; // Noncompliant
```

## Why It Matters

1. **Verbosity**: Two statements where one would suffice
2. **Readability**: The `export...from` syntax is more explicit about intent
3. **Maintainability**: Reduces intermediate variables that serve no purpose
4. **Clarity**: Makes it obvious the module is a re-export, not locally used

## Fix

Use the `export...from` syntax for re-exports:

```javascript
// Named re-exports
export { namedExport } from './bar.js';
export { foo, bar, baz } from './utils.js';

// Default re-export
export { default } from './foo.js';

// Renaming during re-export
export { originalName as newName } from './module.js';
```

## When Local Use Is Required

If you need to use the imported value locally AND re-export it, you must import it separately:

```javascript
// Import for local use
import { helper } from './helpers.js';

// Re-export using export...from (preferred)
export { helper } from './helpers.js';

// Use locally
const result = helper(data);
```

## Common Patterns

```javascript
// Before (S7763 violation)
import { addGoldenExample, getEvalHistory } from './evals-db.js';
export { addGoldenExample, getEvalHistory };

// After (compliant)
export { addGoldenExample, getEvalHistory } from './evals-db.js';

// Before (S7763 violation)
import { delay, parseHtml } from './utils.js';
export { delay, parseHtml };

// After (compliant)
export { delay, parseHtml } from './utils.js';
```

## When It Applies

- Barrel files (index.js that re-export from other modules)
- Backward compatibility exports
- Any import immediately followed by export of the same symbols

## Related

- [MDN: export statement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [eslint-plugin-unicorn: prefer-export-from](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-export-from.md)
