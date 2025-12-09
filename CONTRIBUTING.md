# Contributing to BFSI Insights

## Maintainer

**Rick te Molder** — [@Rick-te-Molder](https://github.com/Rick-te-Molder)

---

## Workflow

We use **Linear** for issue tracking and **GitHub** for code management.

### 1. Pick an Issue

- All work starts with a Linear issue
- Issues are organized in projects and cycles
- Grab an issue from the current cycle or create one if needed

### 2. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b kb-123-short-description
```

**Branch naming convention:** `kb-{issue-id}-{short-description}`

Examples:

- `kb-42-add-filter-component`
- `kb-108-fix-date-parsing`

### 3. Make Changes

- Follow the code style (auto-enforced by pre-commit hooks)
- Run tests locally: `npm run test`
- Keep commits focused and atomic

### 4. Commit with Linear Reference

Include the Linear issue ID in your commit message:

```bash
# Links to issue (doesn't close it)
git commit -m "feat: add industry filter dropdown

KB-123"

# Closes the issue when PR is merged
git commit -m "fix: resolve date parsing edge case

Fixes KB-123"
```

**Magic words** that auto-close Linear issues:

- `fixes KB-123`
- `closes KB-123`
- `resolves KB-123`

### 5. Push and Create PR

```bash
git push -u origin kb-123-short-description
```

Then create a Pull Request on GitHub:

- Target branch: `main`
- Title: Brief description (Linear auto-links via branch name)
- Description: What changed and why

### 6. CI Checks & Merge

- Wait for CI checks to pass (lint, tests, build)
- Review the diff
- Merge using **Squash and merge** (keeps history clean)
- Delete the branch after merging

### 7. Update Linear Issue

Add a summary comment to the Linear issue before closing:

```markdown
## Problem

[What was broken/missing - 1-2 sentences]

## Root Cause

[Why it happened - if applicable]

## Solution

[What was changed to fix it]

## Files Changed

- `path/to/file` - [brief description]

## PR

[GitHub PR link]
```

**Example:**

```markdown
## Problem

Premium source discovery showed alarming "Failed to queue" errors for duplicate URLs.

## Root Cause

Race condition between JS and database URL normalization.

## Solution

Handle duplicate key errors (code 23505) silently, matching existing behavior.

## Files Changed

- `services/agent-api/src/agents/discover.js` - Added duplicate error handling

## PR

https://github.com/Rick-te-Molder/bfsi-insights/pull/140
```

---

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]

[Linear reference]
```

**Types:**

- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code change that neither fixes a bug nor adds a feature
- `docs` — Documentation only
- `test` — Adding or updating tests
- `chore` — Maintenance (deps, config, etc.)

---

## Code Style

- **Linting:** ESLint + Prettier (auto-enforced via pre-commit hook)
- **Formatting:** Runs automatically on commit via lint-staged
- **Tests:** Add tests for new functionality; don't reduce coverage

---

## Database Migration Checklist

When creating Supabase migrations, **always** verify:

### Tables

- [ ] **RLS enabled:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- [ ] **Service role policy:** At minimum, add a policy for `service_role`
- [ ] **Authenticated policy:** Add read/write policies for `authenticated` if needed

```sql
-- Template: New public table
CREATE TABLE public.my_table (...);

ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.my_table
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Functions (SECURITY DEFINER)

- [ ] **Set search_path:** `SET search_path = ''`
- [ ] **Use fully qualified names:** `public.table_name` instead of `table_name`

```sql
CREATE OR REPLACE FUNCTION my_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- REQUIRED
AS $$
BEGIN
  SELECT * FROM public.my_table;  -- Fully qualified
END;
$$;
```

### Views

- [ ] **Use security_invoker:** `WITH (security_invoker = true)`

```sql
CREATE VIEW my_view
WITH (security_invoker = true)
AS SELECT * FROM my_table;
```

### Before Pushing

```bash
# Lint migrations locally
npx supabase db lint
```

---

## Development Setup

```bash
# Clone and install
git clone https://github.com/Rick-te-Molder/bfsi-insights.git
cd bfsi-insights
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Run linting
npm run lint
```

---

## Questions?

Open a Linear issue or reach out to the maintainer.
