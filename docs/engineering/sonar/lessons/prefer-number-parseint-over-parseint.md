---
id: S7773
name: prefer-number-parseint-over-parseint
pattern: "(?<!\\.)\\bparseInt\\s*\\("
extensions: [ts, tsx, js, jsx]
---

# Prefer `Number.parseInt` over `parseInt`

## Problem

Using global `parseInt()` and `parseFloat()` functions instead of their `Number` equivalents.

```typescript
// Non-compliant
const num1 = parseInt('42', 10);
const num2 = parseFloat('3.14');
```

## Why This Matters

1. **Consistency**: All number-related utilities grouped under `Number` namespace
2. **Reduced Global Pollution**: Keeps global namespace cleaner
3. **Modern Standards**: Aligns with ES2015+ JavaScript practices
4. **Better Behavior**: `Number.isNaN()` and `Number.isFinite()` don't coerce non-numbers

## Fix

Replace global parsing functions with their `Number` equivalents:

```typescript
// Compliant
const num1 = Number.parseInt('42', 10);
const num2 = Number.parseFloat('3.14');
```

## Always Include Radix

When using `Number.parseInt()`, always provide the radix (base) parameter:

```typescript
// Good - explicit radix
const num = Number.parseInt('42', 10);

// Bad - missing radix (defaults to 10 but less explicit)
const num = Number.parseInt('42');
```

## Related Functions

| Global         | Number Equivalent     |
| -------------- | --------------------- |
| `parseInt()`   | `Number.parseInt()`   |
| `parseFloat()` | `Number.parseFloat()` |
| `isNaN()`      | `Number.isNaN()`      |
| `isFinite()`   | `Number.isFinite()`   |

## Files Fixed

- `apps/admin/src/app/(dashboard)/agents/utils.ts`
- `apps/admin/src/app/(dashboard)/sources/components/source-form-fields.tsx`
