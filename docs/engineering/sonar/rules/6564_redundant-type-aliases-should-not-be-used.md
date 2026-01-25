# Redundant type aliases should not be used (S6564)

## Rule Details

- **Rule ID**: S6564
- **Type**: Code Smell
- **Severity**: Medium
- **Tags**: typescript, redundant
- **Effort**: 5 min

## Description

Type aliases are useful when they add meaning, constraints, or reuse. However, aliases that simply rename an existing type (especially primitives like `string`) are redundant and add unnecessary indirection.

This rule raises an issue when a type alias does not provide additional value beyond the aliased type.

## Noncompliant Code Example

```typescript
type FilterCategory = string;

function setCategory(category: FilterCategory) {
  // ...
}
```

## Compliant Solution

```typescript
function setCategory(category: string) {
  // ...
}
```

## References

- [SonarSource TypeScript Rule S6564](https://rules.sonarsource.com/typescript/RSPEC-6564/)
