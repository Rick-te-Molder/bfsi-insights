---
id: S4325
name: Redundant assertions should not be used
pattern: "\\bas\\s+\\w+"
extensions: ['.ts', '.tsx', '.js', '.jsx']
blocking: false
---

# Redundant assertions should not be used (S4325)

**Sonar Rule**: S4325  
**Sonar message**: `This assertion is unnecessary since it does not change the type of the expression.`

## The Problem

Type assertions (e.g. `as Foo`) and non-null assertions (`!`) should only be used when they actually change the type and/or are required for correctness.

Redundant assertions are a code smell because they:

- hide real typing problems
- add noise (harder to review)
- can give a false sense of safety

## Fix Patterns

### Pattern 1: Remove redundant `as` assertions

If TypeScript already knows the type, delete the assertion.

```ts
// ❌ BAD
const items = (rows ?? []) as Row[];

// ✅ GOOD
const items = rows ?? [];
```

### Pattern 2: Make the function return type explicit (preferred)

When inference is weak, declare return types and/or introduce typed helpers.

```ts
type Result = { items: Item[]; sources: string[] };
const EMPTY: Result = { items: [], sources: [] };

function mapRow(row: Row): Item { ... }

function mapRows(rows: Row[] | null | undefined): Item[] {
  return (rows ?? []).map(mapRow);
}
```

### Pattern 3: Use Supabase typed results instead of casting

Prefer `.returns<T>()` to align the response type rather than casting `data`.

```ts
const { data } = await supabase
  .from('my_table')
  .select('id')
  .eq('is_active', true)
  .returns<MyRow[]>();
```

## Real Examples from This Codebase

- `apps/admin/src/app/(dashboard)/items/lib/items-page-data.ts`
- `apps/admin/src/app/(dashboard)/items/lib/taxonomy-tags.ts`
