# S4325: Redundant assertions should not be used

**Rule ID**: typescript:S4325  
**Type**: Code Smell  
**Severity**: Minor  
**Effort**: 1 min

## Description

Type assertions and non-null assertions should only be used when they are necessary and actually change the type of the expression.

## Why is this an issue?

Unnecessary assertions add noise and can mask underlying typing issues.

## Noncompliant code example

```typescript
const items = (rows ?? []) as Row[];
const value = foo!;
```

## Compliant solution

```typescript
const items = rows ?? [];

if (!foo) return;
const value = foo;
```

## See also

- [SonarSource Rule](https://rules.sonarsource.com/typescript/RSPEC-4325/)
