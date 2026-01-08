---
id: S6772
name: ambiguous-spacing-after-previous-element
pattern: "/>\n\\s+[A-Za-z]"
extensions: [tsx, jsx]
---

# Ambiguous spacing after previous element

## Problem

JSX removes whitespace between inline elements separated by a line break, which can cause unexpected layout issues.

```tsx
// Non-compliant - ambiguous spacing
<label>
  <input type="checkbox" />
  Enable feature
</label>
```

In this case, JSX collapses the newline and whitespace, potentially removing the expected space between the checkbox and the text.

## Why This Matters

1. **Unexpected Layout**: Missing whitespace between inline elements
2. **Browser Inconsistency**: Different browsers may handle collapsed whitespace differently
3. **Maintainability**: Code behavior doesn't match visual appearance in source

## Fix

Add an explicit JSX space expression `{' '}` between inline elements:

```tsx
// Compliant - explicit spacing
<label>
  <input type="checkbox" /> Enable feature
</label>
```

Alternative: Use an empty comment to indicate intentionally no space:

```tsx
// Compliant - explicit no space
<label>
  <input type="checkbox" />
  {/**/}
  EnableFeature
</label>
```

## When This Applies

This rule triggers when:

- An inline element (like `<input>`, `<span>`, `<a>`) is followed by a line break
- Text content appears on the next line within the same parent

## Files Fixed

- `apps/admin/src/app/(dashboard)/evals/head-to-head/components/controls.tsx`
- `apps/admin/src/app/(dashboard)/sources/components/source-form-fields.tsx`
