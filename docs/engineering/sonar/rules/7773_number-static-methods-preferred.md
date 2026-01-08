---
id: S7773
name: number-static-methods-preferred
---

# S7773: Number static methods and properties should be preferred over global equivalents

## Rule Details

This rule raises an issue when global functions like `parseInt()`, `parseFloat()`, `isNaN()`, or `isFinite()` are used instead of their `Number` constructor equivalents.

## Why

ECMAScript 2015 introduced static methods and properties on the `Number` constructor to replace several global functions and values. Using these `Number` equivalents provides:

- **Consistency and Organization**: All number-related utilities grouped under the `Number` namespace
- **Reduced Global Namespace Pollution**: Keeps global namespace cleaner
- **Improved Behavior**: `Number.isNaN()` and `Number.isFinite()` don't coerce non-numbers
- **Modern JavaScript Standards**: Aligns with ES2015+ practices

## Links

- [SonarSource Rule](https://rules.sonarsource.com/typescript/RSPEC-7773)
- [ESLint: prefer-number-properties](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-number-properties.md)
- [Number.parseInt() - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/parseInt)
- [Number.parseFloat() - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/parseFloat)

## Related Lessons

- [prefer-number-parseint-over-parseint.md](../lessons/prefer-number-parseint-over-parseint.md)
