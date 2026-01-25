# Prefer Nullish Coalescing Assignment (S6606)

## Problem

SonarCloud flags code that uses an if-statement or logical OR to assign a default value when the nullish coalescing assignment operator (`??=`) would be simpler.

## Why It Matters

- `??=` is more concise and readable
- Clearly expresses intent: "assign if nullish"
- Introduced in ES2021 for this exact use case
- Reduces boilerplate code

## Fix Pattern

Replace if-null checks or logical OR assignments with `??=`:

```typescript
// ❌ Bad - verbose if-null check
if (x === null || x === undefined) {
  x = defaultValue;
}

// ❌ Bad - if-null shorthand
if (x === null) x = defaultValue;

// ❌ Bad - logical OR (also catches falsy values like 0, '')
x = x || defaultValue;

// ✅ Good - nullish coalescing assignment
x ??= defaultValue;
```

## Common Cases in This Codebase

### React refs initialization

```typescript
// ❌ Bad
const nowRef = useRef<number | null>(null);
if (nowRef.current === null) nowRef.current = Date.now();

// ✅ Good
const nowRef = useRef<number | null>(null);
nowRef.current ??= Date.now();
```

### Optional parameter defaults

```typescript
// ❌ Bad
function process(options: Options | undefined) {
  if (options === undefined) options = {};
  // ...
}

// ✅ Good
function process(options: Options | undefined) {
  options ??= {};
  // ...
}
```

## When NOT to Use `??=`

Use `||=` instead when you want to replace ALL falsy values (including `0`, `''`, `false`):

```typescript
// Use ||= for falsy values
count ||= 1; // Replaces 0, null, undefined, '', false

// Use ??= for only null/undefined
count ??= 1; // Only replaces null, undefined
```

## Prevention

1. **Use `??=`** for null/undefined default assignments
2. **Use `||=`** when you need to handle all falsy values
3. **Configure ESLint** with `prefer-nullish-coalescing` rule

## References

- [SonarSource Rule S6606](https://rules.sonarsource.com/typescript/RSPEC-6606/)
- [MDN Nullish coalescing assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_assignment)
