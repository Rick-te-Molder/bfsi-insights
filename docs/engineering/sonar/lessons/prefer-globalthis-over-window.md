# Prefer globalThis over window (S7764)

## Problem

SonarCloud flags usage of `window`, `self`, or `global` when accessing global properties. These environment-specific references reduce code portability.

## Why It Matters

- `window` only exists in browsers
- `global` only exists in Node.js
- `self` only exists in Web Workers
- Using environment-specific globals makes code less portable and harder to test

`globalThis` was introduced in ES2020 as a unified solution that works consistently across all JavaScript environments (browsers, Node.js, Web Workers, etc.).

## Fix Pattern

Replace environment-specific global references with `globalThis`:

```typescript
// ❌ Bad - browser-specific
window.location.href = '/items';
const origin = window.location.origin;

// ✅ Good - works everywhere
globalThis.location.href = '/items';
const origin = globalThis.location.origin;
```

## Common Cases in This Codebase

### Navigation redirects

```typescript
// ❌ Bad
export function reloadItem(id: string) {
  window.location.href = `/items/${id}`;
}

// ✅ Good
export function reloadItem(id: string) {
  globalThis.location.href = `/items/${id}`;
}
```

### URL construction

```typescript
// ❌ Bad
const url = new URL(baseUrl, window.location.origin);

// ✅ Good
const url = new URL(baseUrl, globalThis.location.origin);
```

## Prevention

1. **Use globalThis** for all global property access
2. **Configure ESLint** with `unicorn/prefer-global-this` rule
3. **Search and replace** `window.` with `globalThis.` when refactoring

## References

- [SonarSource Rule S7764](https://rules.sonarsource.com/typescript/RSPEC-7764/)
- [MDN globalThis](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis)
- [ECMAScript 2020 globalThis proposal](https://github.com/tc39/proposal-global)
