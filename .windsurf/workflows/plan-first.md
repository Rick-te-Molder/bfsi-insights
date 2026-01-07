---
description: Plan-first prompting - require a change plan before writing code
---

# Plan-First Prompting

Before asking AI to write code, create a spec and get AI's implementation plan.

---

## Step 1: Write the Spec

Create a brief spec with these sections:

```markdown
## Goal

[One sentence: what should exist after this change?]

## Non-Goals

[What this change does NOT include - prevents scope creep]

## Files to Change

- `path/to/file.ts` - what change
- `path/to/new.ts` - (new) purpose

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Risks

- [Known risks or edge cases]

## Tests to Add

- [ ] Test for scenario X
```

---

## Step 2: Ask AI for Implementation Plan

Prompt the AI:

```
Review this spec and propose an implementation plan:
- List files you'll create/modify
- Describe changes to each file
- Note any risks or questions
- Do NOT write code yet

[paste spec]
```

---

## Step 3: Review the Plan

Before approving:

- [ ] Files match your spec's scope
- [ ] No unexpected files being touched
- [ ] Architecture boundaries respected (route → service → repo)
- [ ] Test plan is adequate

---

## Step 4: Implement

Only after plan approval:

```
Proceed with the implementation plan. For each file:
1. Show what you're changing
2. Explain why
3. Add tests as specified
```

---

## Step 5: Verify

After implementation:

- [ ] Run pre-commit hooks
- [ ] Verify acceptance criteria
- [ ] Check AI stayed within scope
- [ ] Review security-sensitive changes manually

---

## Example

**Bad prompt**:

```
Add vendor import feature
```

**Good prompt**:

```
## Goal
Add CSV import for vendor data to the admin vendors page.

## Non-Goals
- Do NOT touch authentication
- Do NOT change existing vendor CRUD
- Do NOT add new dependencies without asking

## Files to Change
- `apps/admin/src/app/vendors/page.tsx` - add import button
- `apps/admin/src/app/vendors/actions.ts` - (new) import action
- `apps/admin/src/lib/csv-parser.ts` - (new) CSV parsing

## Acceptance Criteria
- [ ] Upload button visible on vendors page
- [ ] Accepts .csv files only
- [ ] Rejects rows with invalid data
- [ ] Shows success/error count after import

## Risks
- Large files could timeout
- Duplicate vendor names

## Tests to Add
- [ ] Test valid CSV parsing
- [ ] Test invalid row rejection
- [ ] Test duplicate handling
```
