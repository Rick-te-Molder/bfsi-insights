# Use Logical OR Instead of Ternary for Default Values

## Rule

S6644 - Ternary operator should not be used instead of simpler alternatives

## Problem

Using a ternary operator when the truthy branch returns the same value as the condition:

```typescript
const result = value ? value : defaultValue;
```

## Why It Matters

1. **Readability**: The ternary is redundant when returning the condition itself
2. **Maintainability**: Simpler expressions are easier to understand and modify
3. **Conciseness**: Logical operators express intent more directly

## Fix

Replace the ternary with logical OR (`||`) or nullish coalescing (`??`):

```typescript
// Before (S6644 violation)
const result = value ? value : defaultValue;

// After (using ||)
const result = value || defaultValue;

// After (using ?? for nullish-only)
const result = value ?? defaultValue;
```

## When to Use || vs ??

- Use `||` when any falsy value should trigger the default (empty string, 0, false, null, undefined)
- Use `??` when only `null` or `undefined` should trigger the default

## Common Patterns

```typescript
// Returning trimmed string or null
return trimmed ? trimmed : null; // Bad
return trimmed || null; // Good

// Default value assignment
const name = user.name ? user.name : 'Anonymous'; // Bad
const name = user.name || 'Anonymous'; // Good

// With nullish coalescing (preserves 0, '', false)
const count = data.count ?? 0;
```

## When It Applies

- Any ternary where the truthy result equals the condition
- Default value patterns
- Fallback value assignments

## Related

- [MDN: Logical OR (||)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR)
- [MDN: Nullish coalescing (??)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)
