# Reduce cognitive complexity by extracting helpers (S3776)

## Why this matters

SonarCloud flags functions with high **Cognitive Complexity** because they are harder to reason about and more likely to hide subtle bugs.

Common causes in this repo:

- Many nested `if` / `try` / `catch` blocks in a single route handler
- Long functions that mix validation + side effects + persistence
- Repeated guard checks inside loops

## Preferred fix pattern

- Extract **guard/validation** into a small helper that returns a typed result (e.g. `{ ok: true, ... } | { ok: false, ... }`).
- Extract **side-effect blocks** (e.g. “run step with tracking”, “persist payload”) into helpers.
- Prefer **early returns** / guard clauses over deep nesting.
- Keep behavior unchanged: the goal is structure, not new logic.

## Example (pattern)

Before (high complexity):

- validate request
- load dependencies
- nested `try/catch` for tracking
- merge + persist + validate

After (lower complexity):

- `parseXRequestBody()`
- `runXWithTracking()`
- `mergePersistAndValidate()`

## Notes

This rule is often paired with ESLint rules like `max-depth` and general maintainability guidance.
