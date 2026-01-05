# S7735: Negated conditions should be avoided when an else clause is present

**Rule ID**: typescript:S7735  
**Type**: Code Smell  
**Severity**: Low  
**Tags**: readability

## Why is this an issue?

Negated conditions in if-else statements make code harder to read and understand. When you see `if (!condition)`, your brain has to process the negation, which adds cognitive load.

Positive conditions are generally easier to understand because they describe what _is_ true rather than what is _not_ true.

This rule only flags cases where there's an else clause because single if statements with negated conditions are sometimes the clearest way to express "do something when this condition is false."

## Non-compliant code

```typescript
if (!isValid) {
  handleError();
} else {
  processData();
}

const suffix = count !== 1 ? 's' : '';
```

## Compliant code

```typescript
if (isValid) {
  processData();
} else {
  handleError();
}

const suffix = count === 1 ? '' : 's';
```

## See also

- [SonarSource Rule: typescript:S7735](https://rules.sonarsource.com/typescript/RSPEC-7735/)
