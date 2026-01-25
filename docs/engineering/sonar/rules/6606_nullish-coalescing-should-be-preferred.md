# Nullish coalescing should be preferred (S6606)

## Rule Details

- **Rule ID**: S6606
- **Type**: Code Smell
- **Severity**: Low
- **Tags**: es2020, nullish-coalescing
- **Effort**: 5 min

## Description

Nullish coalescing should be preferred over logical OR (`||`) or ternary expressions when assigning default values for `null` or `undefined`.

The nullish coalescing operator (`??`) and nullish coalescing assignment (`??=`) were introduced in ES2020/ES2021 specifically for this use case. They only trigger on `null` or `undefined`, unlike `||` which triggers on any falsy value.

Using `??` or `??=` makes code more readable and clearly expresses the intent to handle only nullish values.

## Noncompliant Code Example

```typescript
function either(x: number | undefined, y: number) {
  return x || y; // Noncompliant - also replaces 0
}

function either(x: number | undefined, y: number) {
  return x !== undefined ? x : y; // Noncompliant - verbose
}

if (x === null) x = defaultValue; // Noncompliant
```

## Compliant Solution

```typescript
function either(x: number | undefined, y: number) {
  return x ?? y;
}

x ??= defaultValue;
```

## References

- [SonarSource TypeScript Rule S6606](https://rules.sonarsource.com/typescript/RSPEC-6606/)
- [MDN Nullish coalescing operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)
- [MDN Nullish coalescing assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_assignment)
