# S6644: Ternary operator should not be used instead of simpler alternatives

## Rule Details

- **Rule ID**: S6644
- **Type**: Code Smell
- **Severity**: Low
- **Category**: Maintainability

## Description

Ternary operator should not be used to select between two boolean values, or instead of a logical OR operation. Ternary expressions are often difficult to read, so if a simpler syntax exists, it should be used instead.

This happens when:

- The expression returns two boolean values
- The same value is used for both the conditional test and the consequent

## Why

- **Readability**: Simpler alternatives are more immediately understandable
- **Consistency**: Using standard patterns makes code more predictable
- **Maintainability**: Less cognitive load for developers

## Non-compliant

```typescript
let isGood = value > 0 ? true : false; // Non-compliant, replace with value > 0
let isBad = value > 0 ? false : true; // Non-compliant, replace with !(value > 0)
let a = x ? x : y; // Non-compliant, replace with x || y
```

## Compliant

```typescript
let isGood = value > 0;
let isBad = !(value > 0);
let a = x || y;
```

## Links

- [SonarSource Rule](https://rules.sonarsource.com/typescript/RSPEC-6644)

## Related Lessons

- [use-logical-or-instead-of-ternary-for-default-values.md](../lessons/use-logical-or-instead-of-ternary-for-default-values.md)
