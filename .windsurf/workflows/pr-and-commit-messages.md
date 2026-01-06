---
description: How to write PR descriptions and commit messages for traceability
---

# PR and Commit Message Standards

This workflow ensures code changes are traceable through git history.

---

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type (required)

- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or updating tests
- `docs` - Documentation only
- `chore` - Maintenance (deps, config, CI)
- `perf` - Performance improvement

### Scope (required if KB issue exists)

- Linear issue ID: `KB-XXX`
- If no issue: omit scope or use component name

### Subject (required)

- Imperative mood ("add" not "added")
- No period at end
- Max 72 characters

### Body (required for non-trivial changes)

```
## What changed
- Brief description of the change

## Files
- `path/to/file.ts` - what changed in this file
- `path/to/new-file.ts` - (new) purpose of new file

## Why
- Reason for the change (link to issue, bug, requirement)
```

### Footer (optional)

- `Closes KB-XXX` or `Fixes KB-XXX`
- `BREAKING CHANGE:` if applicable

### Examples

**Minimal (trivial fix):**

```
fix: typo in error message
```

**Standard:**

```
feat(KB-301): add bulk approve action to review queue

## What changed
- Added bulk selection UI to review table
- Added server action for batch approval

## Files
- `apps/admin/src/app/(dashboard)/review/page.tsx` - added checkbox column
- `apps/admin/src/app/(dashboard)/review/actions.ts` - (new) bulk approve action
- `apps/admin/src/components/ui/bulk-action-bar.tsx` - (new) reusable component

## Why
Users requested ability to approve multiple items at once (KB-301)
```

---

## PR Description Format

PRs are documentation. They explain WHAT changed, WHERE, and WHY.

```markdown
## Summary

One paragraph explaining the change at a high level.

## Changes

### Files Created

- `path/to/new-file.ts` - purpose
- `path/to/another-new.ts` - purpose

### Files Modified

- `path/to/modified.ts` - what changed
- `path/to/updated.tsx` - what changed

### Files Deleted

- `path/to/removed.ts` - why removed

## Why

Link to Linear issue or explain the motivation.

## Testing

How to verify this works:

- [ ] Step 1
- [ ] Step 2

Or: `npm run test -- --run path/to/test`

## Notes (optional)

Any additional context, trade-offs, or follow-up work needed.

---

Closes https://linear.app/knowledge-base/issue/KB-XXX
```

### PR Description Rules

1. **Always list files** - Every created/modified/deleted file with brief description
2. **Group by action** - Created vs Modified vs Deleted
3. **Include paths** - Full relative paths from repo root
4. **Explain each file** - What changed or why it exists
5. **Link to Linear** - Full URL at bottom for auto-close

---

## Quick Reference

### Before Committing

```bash
# List files that will be in commit
git diff --cached --name-status

# Use this output to build your commit message body
```

### Before Creating PR

```bash
# List all files changed in this branch vs main
git diff main --name-status

# Use this output to build your PR description
```

---

## Enforcement

This format is enforced by:

1. `.windsurfrules` - AI assistants must follow this format
2. PR review checklist - Humans verify file lists are complete
3. Pre-commit hook (future) - Could validate commit message format
