---
id: S7735
name: Negated condition with else clause
pattern: "if\\s*\\(\\s*!\\s*\\w+[^)]*\\)\\s*\\{[^}]*\\}\\s*else\\s*\\{"
extensions: ['.ts', '.tsx', '.js', '.jsx']
---

# Unexpected negated condition

**Sonar Rule**: S7735  
**Sonar Message**: `Unexpected negated condition.`

## Pattern

When you have a negated condition (`!`, `!==`) with an else branch, invert the condition and swap the branches.

## Fix Strategy

### 1. If-else statements with negated condition

```typescript
// Before
if (!error) {
  doSuccess();
} else {
  handleError();
}

// After
if (error) {
  handleError();
} else {
  doSuccess();
}
```

### 2. Ternary operators with `!==`

```typescript
// Before (common pluralization pattern)
const suffix = count !== 1 ? 's' : '';

// After
const suffix = count === 1 ? '' : 's';
```

### 3. Ternary operators with `!== undefined`

```typescript
// Before
const text = value !== undefined ? formatValue(value) : '';

// After
const text = value === undefined ? '' : formatValue(value);
```

## Files fixed with this pattern

- `apps/admin/src/app/(dashboard)/agents/[agent]/components/AgentHeader.tsx`
- `apps/admin/src/app/(dashboard)/agents/components/AgentTableRowParts.tsx`
- `apps/admin/src/app/(dashboard)/evals/head-to-head/hooks/useHeadToHeadData.ts`
- `apps/admin/src/app/(dashboard)/page.tsx`

## Why this matters

- **Reduced cognitive load**: Positive conditions are easier to understand
- **Readability**: Code reads more naturally ("if valid, process" vs "if not valid, error")
- **Consistency**: Establishes a standard pattern across the codebase
