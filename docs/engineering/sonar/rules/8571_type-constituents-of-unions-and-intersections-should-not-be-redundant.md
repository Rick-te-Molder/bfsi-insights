# Type constituents of unions and intersections should not be redundant (S8571)

## Rule Details

- **Rule ID**: S8571
- **Type**: Code Smell
- **Severity**: Low
- **Tags**: redundant, type-dependent
- **Effort**: 5 min

## Description

When defining a union or intersection in TypeScript, it is possible to mistakenly include type constituents that encompass other constituents, that don't have any effect, or that are more restrictive.

For instance:

- The type `something` in `any | something` is redundant because `any` covers all possible types
- The types `never` in unions like `never | something` or `unknown` in intersections like `unknown & something` are effectless
- More restrictive types in intersections like the literal type `1` in `1 & number` reduce the set of possible values to specific ones

Eliminating redundant types from a union or intersection type simplifies the code and enhances its readability. Moreover, it provides a clearer representation of the actual values that a variable can hold.

## Noncompliant Code Example

```typescript
type UnionWithAny = any | 'redundant'; // Noncompliant
type UnionWithNever = never | 'override'; // Noncompliant
type UnionWithLiteral = number | 1; // Noncompliant

type IntersectionWithAny = any & 'redundant'; // Noncompliant
type IntersectionWithUnknown = string & unknown; // Noncompliant
type IntersectionWithLiteral = string & 'override'; // Noncompliant
```

## Compliant Solution

```typescript
type UnionWithAny = any;
type UnionWithNever = 'override';
type UnionWithLiteral = number;

type IntersectionWithAny = any;
type IntersectionWithUnknown = string;
type IntersectionWithLiteral = 'override';
```

## References

- [SonarSource TypeScript Rule S8571](https://rules.sonarsource.com/typescript/RSPEC-8571/)
- [TypeScript Union Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
