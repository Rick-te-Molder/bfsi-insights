# Coding Practices & Lessons Learned

This document captures coding practices learned from bugs and incidents.

---

## Taxonomy & Tag Insertion (KB-219)

### Rule: Use `taxonomy_config` for dynamic tag insertion

When inserting tags on approve, **always use the `taxonomy_config` table** instead of hardcoding tag types.

### Pattern

```typescript
// ✅ CORRECT: Dynamic tag insertion from taxonomy_config
const { data: taxonomyConfigs } = await supabase
  .from('taxonomy_config')
  .select('payload_field, junction_table, junction_code_column')
  .eq('is_active', true)
  .not('junction_table', 'is', null);

for (const config of taxonomyConfigs) {
  const codes = payload[config.payload_field] as string[];
  if (codes?.length && config.junction_table) {
    await supabase.from(config.junction_table).insert(
      codes.map(code => ({
        publication_id: pubId,
        [config.junction_code_column]: code,
      }))
    );
  }
}

// ❌ WRONG: Hardcoded tag types
if (payload.industry_codes?.length) {
  await supabase.from('kb_publication_bfsi_industry').insert(...);
}
if (payload.topic_codes?.length) {
  await supabase.from('kb_publication_bfsi_topic').insert(...);
}
// ... more hardcoded types
```

### Why

- `taxonomy_config` is the **single source of truth** for all tag categories
- Adding new tag types requires only a DB row, no code changes
- Prevents hardcoded lists that drift out of sync with the database schema

### Files using this pattern

- `admin-next/src/app/(dashboard)/review/actions.ts`
- `admin-next/src/app/(dashboard)/review/carousel/carousel-review.tsx`
- `admin-next/src/app/(dashboard)/review/[id]/actions.tsx`

### Context

The `taxonomy_config` table was created in migration `20251210155649_create_taxonomy_config.sql` as a central registry for all tag categories. It defines:

- `payload_field` - where to find the codes in the payload (e.g., `industry_codes`)
- `junction_table` - which table to insert into (e.g., `kb_publication_bfsi_industry`)
- `junction_code_column` - the column name for the code (e.g., `industry_code`)

---

## Adding New Practices

When you encounter a bug or incident:

1. Identify the **root cause pattern** (not just the symptom)
2. Add a rule here that would have prevented it
3. Include the Linear issue ID for context
