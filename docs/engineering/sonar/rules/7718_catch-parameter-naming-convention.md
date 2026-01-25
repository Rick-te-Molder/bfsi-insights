# Error parameters in catch clauses should follow a consistent naming convention (S7718)

## Rule Details

- **Rule ID**: S7718
- **Type**: Code Smell
- **Severity**: Low
- **Tags**: convention, error-handling
- **Effort**: 5 min

## Description

This rule raises an issue when error parameters in `try/catch` blocks, `promise.catch()` handlers, or `promise.then()` rejection handlers don't follow the configured naming convention (defaults to `error`).

Consistent naming of error parameters improves code readability and maintainability across your codebase. When developers use different names for error parameters (`err`, `e`, `exception`, `badName`), it creates unnecessary cognitive overhead when reading and maintaining code.

This rule applies to three common JavaScript error handling patterns:

- Traditional `try/catch` blocks
- Promise `.catch()` methods
- Promise `.then()` rejection handlers (second parameter)

The rule is flexible and allows descriptive names like `fsError` or `authError` when they provide meaningful context about the type of error being handled.

## Noncompliant Code Example

```typescript
try {
  riskyOperation();
} catch (badName) {
  // Noncompliant
  console.log(badName.message);
}
```

## Compliant Solution

```typescript
try {
  riskyOperation();
} catch (error) {
  console.log(error.message);
}
```

## References

- [SonarSource TypeScript Rule S7718](https://rules.sonarsource.com/typescript/RSPEC-7718/)
- [eslint-plugin-unicorn: catch-error-name](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/catch-error-name.md)
