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

- `apps/admin/src/app/(dashboard)/review/actions.ts`
- `apps/admin/src/app/(dashboard)/review/carousel/carousel-review.tsx`
- `apps/admin/src/app/(dashboard)/review/[id]/actions.tsx`

### Context

The `taxonomy_config` table was created in migration `20251210155649_create_taxonomy_config.sql` as a central registry for all tag categories. It defines:

- `payload_field` - where to find the codes in the payload (e.g., `industry_codes`)
- `junction_table` - which table to insert into (e.g., `kb_publication_bfsi_industry`)
- `junction_code_column` - the column name for the code (e.g., `industry_code`)

---

## Code Quality Enforcement (KB-151)

### Rule: Boy Scout Rule - Leave code cleaner than you found it

All code that passes through your hands must meet Quality Guidelines.

### Quality Guidelines (Enforced on ALL touched files)

**File Size:**

- Aim for a file length of max 200-250 lines.
- Files MUST be < 300 lines (upper limit)
- Extract large files into smaller, focused modules

**Unit Size (Functions/Methods):**

- Aim for a function length of max 15-20 lines.
- Functions MUST be < 30 lines (upper limit)
- Functions SHOULD be < 15 lines (excellent)
- Extract large functions into smaller, focused helpers

### Enforcement

The pre-commit hook (`scripts/ci/check-large-files.cjs`) checks ALL staged files:

- ✅ **Blocks commits** if any staged file violates guidelines
- 🧹 **Boy Scout Rule**: If you touch a file, you must clean it
- 📋 **No exceptions**: Even files with known violations must be refactored when touched
- 🎉 **Celebrates cleanups**: Shows when known violators are fixed

### Known Violations

- See docs/architecture/quality/known-large-files.md
- See docs/architecture/quality/known-large-functions.md
- See docs/architecture/quality/exceptions.md

### How to Fix

**Large files (> 300 lines):**

1. Extract helper functions to separate modules
2. Split into multiple focused files
3. Move reusable code to shared utilities
4. Aim for a file length of max 200-250 lines.

**Large functions (> 30 lines):**

1. Extract logical sections into helper functions
2. Use single-responsibility principle
3. Name helpers descriptively for what they do
4. Aim for a function length of max 15-20 lines.

### Example Refactoring

```typescript
// ❌ BEFORE: 80-line function
function processData(items) {
  // 20 lines of validation
  // 30 lines of transformation
  // 30 lines of storage
}

// ✅ AFTER: Small, focused functions
function processData(items) {
  const validated = validateItems(items);
  const transformed = transformItems(validated);
  return storeItems(transformed);
}

function validateItems(items) {
  /* 15 lines */
}
function transformItems(items) {
  /* 20 lines */
}
function storeItems(items) {
  /* 25 lines */
}
```

### Why

- **Maintainability**: Smaller units are easier to understand and modify
- **Testability**: Focused functions are easier to test in isolation
- **Reusability**: Small functions can be reused in multiple contexts
- **Debugging**: Easier to locate and fix issues in small units
- **Code Review**: Easier to review and reason about small changes

### Context

Pre-commit enforcement implemented in commits:

- `02b3c80` - Initial Quality Gate checker with grandfathering
- `5c2253a` - Boy Scout rule enforcement (no exceptions)

---

## Local Linting (SonarQube for IDE)

### Rule: Fix SonarCloud issues before committing

Install **SonarQube for IDE** in Windsurf and connect it to SonarCloud (Connected Mode). This syncs your local analysis with the project's quality profile, ensuring you catch the same issues CI will catch.

### Setup

1. Install the **SonarQube for IDE** extension in Windsurf
2. Open Command Palette → "SonarQube for IDE: Connect to SonarCloud"
3. Authenticate with your SonarCloud account
4. Select the `bfsi-insights` project

### Workflow

1. SonarQube for IDE highlights issues in real-time as you code
2. Fix issues before committing
3. If an issue cannot be fixed, document it in `docs/architecture/quality/exceptions.md`

### Why

- **Shift-left**: Catch issues before they reach CI
- **Same rules**: Connected Mode uses the exact quality profile from SonarCloud
- **Faster feedback**: No waiting for CI pipeline
- **Zero CI cost**: Issues are caught locally, not in Slow CI

---

## Adding New Practices

When you encounter a bug or incident:

1. Identify the **root cause pattern** (not just the symptom)
2. Add a rule here that would have prevented it
3. Include the issue/ticket ID for context
