---
id: S7781
name: Use replaceAll instead of replace with /g
pattern: \\.replace\\s*\\(\\s*/[^/]+/g\\s*,
extensions: ['.ts', '.tsx', '.js', '.jsx']
---

# Prefer 'String#replaceAll()' over 'String#replace()'

**Sonar Rule**: S7781  
**Sonar Message**: `Prefer 'String#replaceAll()' over 'String#replace()'.`

## Pattern

When you see `.replace(/pattern/g, replacement)`, convert to `.replaceAll()`.

## Fix Strategy

1. **Simple string patterns** → Use string literal:

   ```typescript
   // Before
   name.replace(/_/g, ' ');

   // After
   name.replaceAll('_', ' ');
   ```

2. **Regex patterns** → Remove the `g` flag:

   ```typescript
   // Before
   title.replace(/[^a-z0-9]+/g, '-');

   // After
   title.replaceAll(/[^a-z0-9]+/, '-');
   ```

3. **Alternation patterns** → Add explicit grouping (prevents S5869):

   ```typescript
   // Before
   slug.replace(/^-|-$/g, '');

   // After
   slug.replaceAll(/(^-)|(-$)/, '');
   ```

## Files fixed with this pattern

- `apps/admin/src/app/(dashboard)/items/[id]/propose-entity.tsx`
- `apps/admin/src/app/(dashboard)/items/[id]/unknown-entities.tsx`
- `apps/admin/src/app/(dashboard)/items/lib/publication-helpers.ts`
- `apps/admin/src/components/ui/status-pill.tsx`

## Why this matters

- **Clearer intent**: `replaceAll` explicitly states all occurrences will be replaced
- **Safer**: No need to remember the `g` flag
- **ES2021 standard**: Modern JavaScript best practice
