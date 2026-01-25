# Catch Parameter Naming Convention (S7718)

## Problem

SonarCloud flags catch clause parameters that don't follow the configured naming convention. The default convention expects `error` as the parameter name.

## Why It Matters

- Consistent naming helps developers quickly identify error handling code
- Reduces cognitive overhead when reading and maintaining code
- Makes codebase navigation more efficient
- Prevents mental context switching between different naming styles

## Fix Pattern

Rename catch parameters to use `error` (or `error_` if shadowing):

```typescript
// ❌ Bad - non-standard names
try {
  riskyOperation();
} catch (e) {
  console.log(e.message);
}

try {
  riskyOperation();
} catch (e2) {
  console.log(e2.message);
}

try {
  riskyOperation();
} catch (badName) {
  console.log(badName.message);
}

// ✅ Good - standard name
try {
  riskyOperation();
} catch (error) {
  console.log(error.message);
}

// ✅ Good - with underscore suffix when shadowing
try {
  outerOperation();
} catch (error) {
  try {
    innerOperation();
  } catch (error_) {
    console.log(error_.message);
  }
}
```

## Acceptable Names

The rule allows descriptive names that provide context:

- `error` (preferred)
- `error_` (when shadowing)
- `fsError` (for file system errors)
- `authError` (for authentication errors)

## Prevention

1. **Always use `error`** as the catch parameter name
2. **Use `error_`** when nesting try-catch blocks
3. **Use descriptive suffixes** like `fsError` when handling specific error types

## References

- [SonarSource Rule S7718](https://rules.sonarsource.com/typescript/RSPEC-7718/)
- [MDN try...catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch)
