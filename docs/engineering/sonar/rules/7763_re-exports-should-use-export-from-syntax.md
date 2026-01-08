# S7763: Re-exports should use "export...from" syntax

## Rule Details

- **Rule ID**: S7763
- **Type**: Code Smell
- **Severity**: Low
- **Category**: Maintainability, Consistency

## Description

This rule raises an issue when code imports from a module and then immediately exports the same identifiers without using them elsewhere. When re-exporting from a module, using separate import and export statements creates unnecessary verbosity and intermediate variables.

JavaScript provides the `export...from` syntax specifically for this use case.

## Why

- **Clarity**: The `export...from` syntax is more explicit about the intent to re-export
- **Conciseness**: One statement instead of two
- **No intermediate variables**: Eliminates unused imports
- **Convention**: Standard JavaScript idiom for barrel exports

## Non-compliant

```javascript
import defaultExport from './foo.js';
export default defaultExport; // Noncompliant

import { namedExport } from './bar.js';
export { namedExport }; // Noncompliant
```

## Compliant

```javascript
export { default } from './foo.js';
export { namedExport } from './bar.js';
```

## Links

- [SonarSource Rule](https://rules.sonarsource.com/javascript/RSPEC-7763)
- [MDN: export statement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)

## Related Lessons

- [use-export-from-for-re-exports.md](../lessons/use-export-from-for-re-exports.md)
