# Lessons Learned (General)

---

**Version**: 1.0.0  
**Last updated**: 2026-01-04  
**Quality System Control**: C4 (Data consistency), C10 (Prompt governance)  
**Change history**:

- 1.0.0 (2026-01-04): Initial version with taxonomy and prompt version patterns from .windsurfrules.

---

This document captures lessons learned from bugs, incidents, and code review feedback. Each entry describes a pattern to follow (or avoid) and why.

**Update policy**: Add a new entry whenever:

- A bug reveals a recurring pattern
- An incident has a generalizable root cause
- Review feedback indicates unclear expectations

**Note**: SonarCloud-specific lessons are in `docs/engineering/sonar/sonarcloud.md`.

---

## Data Consistency Patterns

### Use `taxonomy_config` for dynamic tag insertion

**Control**: C4 (Data consistency)  
**Origin**: KB-219

**Problem**: Hardcoding tag types in approve handlers means adding new tag categories requires code changes and risks drift between code and database config.

**Pattern to follow**:

```ts
const { data: configs, error } = await supabase
  .from('taxonomy_config')
  .select('payload_field, junction_table, junction_code_column')
  .eq('is_active', true)
  .not('junction_table', 'is', null);

if (error) throw error;

for (const config of configs ?? []) {
  const codes = payload[config.payload_field] as string[];

  if (codes?.length && config.junction_table) {
    await supabase.from(config.junction_table).insert(
      codes.map((code) => ({
        publication_id: pubId,
        [config.junction_code_column]: code,
      })),
    );
  }
}
```

**Why**: `taxonomy_config` is the single source of truth for all tag categories. Adding new tag types requires only a DB row, no code changes.

**Files using this pattern**:

- `apps/admin/src/app/(dashboard)/review/actions.ts`
- `apps/admin/src/app/(dashboard)/review/carousel/carousel-review.tsx`
- `apps/admin/src/app/(dashboard)/review/[id]/actions.tsx`

---

### Use `status_code` (numeric), never `status` (text)

**Control**: C4 (Data consistency)  
**Origin**: Pipeline status incidents

**Problem**: The `status` text field and `status_code` numeric field can drift. Queries using `status` text may return inconsistent results.

**Pattern to follow**:

- Always use `status_code` (numeric) for pipeline status queries
- Load status codes from the `status_lookup` table at runtime
- Never hardcode status code values

**Reference**: `services/agent-api/src/lib/status-codes.js`  
**Docs**: `docs/architecture/pipeline-status-codes.md`

---

### Query pattern consistency across views

**Control**: C4 (Data consistency)  
**Origin**: Dashboard inconsistency bugs

**Problem**: Different UI views showing the same data with different query logic leads to confusing discrepancies.

**Pattern to follow**:

- Same data must use identical query logic across UI views
- No client-side filtering that contradicts DB-level filters
- When adding a new view of existing data, check how other views query it first

---

## Prompt Engineering Patterns

### Always INSERT new prompt versions, never UPDATE

**Control**: C10 (Prompt governance)  
**Origin**: Prompt version history bugs

**Problem**: Updating existing prompt rows keeps the original `created_at` timestamp, causing confusion in version history.

**Pattern to follow**:

```sql
-- Mark old version as not current
UPDATE prompt_version
SET is_current = false
WHERE agent_name = 'X' AND is_current = true;

-- INSERT new version (gets correct created_at automatically)
INSERT INTO prompt_version (
  agent_name,
  version,
  prompt_text,
  is_current,
  notes
)
VALUES (
  'X',
  'vYYYYMMDD-01',
  '... full prompt text ...',
  true,
  'KB-XXX: What changed and why'
);
```

**Why**: INSERT creates a new row with a fresh `created_at` timestamp. UPDATE modifies an existing row, keeping the original `created_at`.

---

### Fail-fast for missing prompts

**Control**: C10 (Prompt governance)  
**Origin**: KB-206

**Problem**: Silent fallbacks to hardcoded prompts mask configuration errors and lead to unexpected agent behavior.

**Pattern to follow**:

```ts
const prompt = await getPromptForAgent(agentName);
if (!prompt) {
  throw new Error(`CRITICAL: No prompt found for agent '${agentName}'`);
}
```

**Why**: Agents must throw errors if required prompts are missing. No silent fallbacks to hardcoded prompts.
