# Remove redundant type aliases (S6564)

## Problem

SonarCloud flags type aliases that are redundant — typically when they simply rename a primitive type (e.g., `string`, `number`, `boolean`) or a direct equivalent type without adding constraints.

## Why It Matters

- Redundant aliases add indirection without adding safety.
- They make it harder to understand what the code actually accepts.
- They add maintenance overhead when refactoring types.

## Common Patterns

### Primitive alias

```typescript
// ❌ Bad
export type FilterCategory = string;

// ✅ Good
const category: string = 'news';
```

### Alias used only as a wrapper type

```typescript
// ❌ Bad
type UserId = string;

function loadUser(id: UserId) {}

// ✅ Good
function loadUser(id: string) {}
```

## Fix Pattern

1. Replace occurrences of the alias with the underlying type.
2. Remove the alias export.

## Notes for this codebase

If you truly need semantics, prefer:

- A _constrained_ union (e.g., `'standard' | 'premium'`)
- A branded type (only where we already use that pattern)

But if the alias is just `string`, inline `string`.

## References

- [SonarSource Rule S6564](https://rules.sonarsource.com/typescript/RSPEC-6564/)
