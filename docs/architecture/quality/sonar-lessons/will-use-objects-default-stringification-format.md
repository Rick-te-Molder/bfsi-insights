# Will use Object's default stringification format (S6551)

**Rule**: S6551 - Objects and classes converted or coerced to strings should define a "toString()" method

**Sonar message**: `'X' will use Object's default stringification format ('[object Object]') when stringified.`

## Problem

When coercing `unknown` values to strings (via template literals, `String()`, or `+`), objects without a custom `toString()` method return `[object Object]`.

## Fix Pattern

Add **type guards** before coercing to string:

### For string values

```typescript
// ❌ Noncompliant
const text = String(reasoning); // Could be "[object Object]"

// ✅ Compliant
const text = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning);
```

### For number values

```typescript
// ❌ Noncompliant
const tokens = String(u.prompt_tokens || 0); // Could be "[object Object]0"

// ✅ Compliant
function toNumber(val: unknown): number {
  return typeof val === 'number' ? val : 0;
}
const tokens = toNumber(u.prompt_tokens);
```

### For optional string in template literal

```typescript
// ❌ Noncompliant
alt={`${payload.source_name || 'Source'} preview`}

// ✅ Compliant
alt={`${typeof payload.source_name === 'string' ? payload.source_name : 'Source'} preview`}
```

## Why this pattern?

1. **Type safety**: Explicit checks prevent runtime surprises
2. **Clear intent**: Shows what type is expected
3. **Graceful fallback**: `JSON.stringify` for objects, defaults for missing values

## Files fixed with this pattern

- `apps/admin/src/app/(dashboard)/evals/head-to-head/output-display.tsx`
- `apps/admin/src/app/(dashboard)/items/[id]/page-components.tsx`
