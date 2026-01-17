---
description: Bugfix prompt template for surgical fixes with repro steps and DoD
---

# Bugfix Template

Use this template for surgical bug fixes with clear repro steps and definition of done.

## Goal

Fix: <one-line description of the bug>

## Context

- **Repo/workspace**: <path or package>
- **Branch**: <name>
- **Environment**: <node version / OS / browser>
- **Related ticket/ADR**: <link or id>

## Symptoms

- **What breaks**: <error message / stack trace>
- **Where**: <file(s) / route / function>
- **Frequency**: <always / intermittent; if intermittent, when>

## Reproduction steps

1. <exact commands>
2. <exact inputs>
3. <what to click / what API call>
4. **Observed**: <actual result>

## Expected behavior

<what should happen>

## Constraints (must keep true)

- Do not change public API / schemas unless explicitly required.
- Minimal diff; no unrelated lint/format changes.
- Keep existing behavior for <list> intact.
- If you touch types, prefer local types over broad refactors.

## Change plan

1. Identify root cause (point to exact line(s)).
2. Implement the smallest fix.
3. Add/adjust tests to prevent regression.
4. Run: <commands> and report results.

## Definition of done

- Repro no longer fails.
- Tests added/updated and pass (<test command>).
- No new lint/type errors in touched files.
- Explain the fix in 3–6 bullets and list files changed.

## Deliverables

- Patch/diff.
- Root cause summary.
- Test evidence (command + output summary).

## Practical tips that improve results

- Paste the full stack trace (not just the top line).
- Include "where you suspect the bug lives" but label it as a suspicion.
- State whether the agent may change code outside the module (default: no).
- Require a test or a reproducible check; otherwise you get "fixes" that are guessy.
- Add a "don't do" list (no refactors, no renames, no dependency bumps) if you want a surgical fix.
