# Remove Redundant Union Type Constituents (S8571)

## Problem

SonarCloud flags union or intersection types that contain redundant constituents. A type is redundant when it's already covered by another type in the union.

## Why It Matters

- Redundant types clutter the code without adding value
- They can mislead developers about what values are actually valid
- Removing them makes the type definition clearer and more accurate

## Common Patterns

### String literal with `string`

```typescript
// ❌ Bad - 'all' is redundant because string covers all possible strings
type FilterCategory = 'all' | string;

// ✅ Good - just use string
type FilterCategory = string;
```

### Any in unions

```typescript
// ❌ Bad - 'redundant' is covered by any
type UnionWithAny = any | 'redundant';

// ✅ Good
type UnionWithAny = any;
```

### Never in unions

```typescript
// ❌ Bad - never is effectless in unions
type UnionWithNever = never | 'override';

// ✅ Good
type UnionWithNever = 'override';
```

### Literal with its base type

```typescript
// ❌ Bad - 1 is redundant because number covers it
type UnionWithLiteral = number | 1;

// ✅ Good
type UnionWithLiteral = number;
```

## When to Keep Specific Literals

If you need type safety for specific values, use only the literals:

```typescript
// ✅ Good - specific allowed values
type FilterTier = 'all' | 'standard' | 'premium';

// ✅ Good - open-ended with semantic alias
type FilterCategory = string;
```

## Prevention

1. **Don't mix literals with their base types** in unions
2. **Review union types** for constituents that overlap
3. **Use semantic type aliases** for open-ended string types

## References

- [SonarSource Rule S8571](https://rules.sonarsource.com/typescript/RSPEC-8571/)
- [TypeScript Union Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
