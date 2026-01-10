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

- If an issue ID exists: include it (project-specific format)
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

Link to the relevant issue/ticket (if any) or explain the motivation.

## Testing

How to verify this works:

- [ ] Step 1
- [ ] Step 2

Or: `npm run test -- --run path/to/test`

## Notes (optional)

Any additional context, trade-offs, or follow-up work needed.

---

Issue: <link-if-any>
```

### PR Description Rules

1. **Always list files** - Every created/modified/deleted file with brief description
2. **Group by action** - Created vs Modified vs Deleted
3. **Include paths** - Full relative paths from repo root
4. **Explain each file** - What changed or why it exists
5. **Link to issue/ticket (if any)** - Use a full URL if available

---

## Quick Reference

---

## Shell Quoting Gotchas (zsh)

When running `git commit -m ...` or `gh pr create --body "..."` in `zsh`, the shell can interpret parts of your message as commands or globs.

### Common pitfalls

1. **Backticks**
   - Backticks run command substitution in the shell.
   - Example: `` `apps/admin/src/app/api/jobs/[agent]/start/route.ts` `` will be executed as a command, not treated as text.

2. **Square brackets**
   - `zsh` treats `[...]` as a glob character class.
   - Example: `jobs/[agent]/start` is treated as a glob, not literal text.

3. **Unquoted colons and slashes in some contexts**
   - In error cases you may see confusing `no such file` or `permission denied` messages when the shell tries to interpret parts of the body.

### Safe patterns (use these)

1. **Prefer `--body-file` for PR bodies** (recommended)
   - Create a file `pr-body.md` with markdown content.
   - Then run:

   ```bash
   gh pr create --title "..." --body-file pr-body.md --base main
   ```

2. **Use a heredoc (no interpolation)**

   ```bash
   gh pr create --title "..." --body "$(cat <<'EOF'
   ## Summary
   ...

   ### Files Modified
   - `apps/admin/src/app/api/jobs/[agent]/start/route.ts` - ...

   Closes https://linear.app/knowledge-base/issue/KB-XXX
   EOF
   )" --base main
   ```

   Notes:
   - The **single quotes** in `<<'EOF'` prevent `zsh` expansion.
   - This avoids backtick and glob interpretation.

3. **If you must inline text, single-quote the whole message**
   - Single quotes prevent globbing and command substitution.
   - If you need a literal single quote inside, close/open the string.

   ```bash
   git commit -m 'fix: message' -m '## Files
   - `path/with/[brackets].ts` - ...'
   ```

---

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
