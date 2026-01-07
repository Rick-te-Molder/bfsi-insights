# GitHub Actions: Node + ESM Standardization Plan

## Goal

Make GitHub Actions execution deterministic by standardizing:

- Node.js version selection
- Module mode for inline Node execution (ESM-explicit)
- Dependency installation and module resolution in a monorepo

Keep CommonJS only where tooling explicitly requires it (e.g., `*.cjs` config files).

## Scope

This plan applies to workflows under `.github/workflows/`.

## Principles (Standards)

### 1) Node version: one source of truth

- Use `actions/setup-node@v4` everywhere.
- Use `node-version-file: '.nvmrc'` in every job.
- Keep `package.json -> engines.node` as documentation/intent (does not replace `.nvmrc`).

### 2) Module mode: ESM-explicit (determinism)

The objective is not “everything ESM”, it is that module mode is explicit when running Node inline.

- Inline snippets using ESM features must run with:
  - `node --input-type=module -e "..."`
  - or be moved into committed `.mjs` scripts.
- Tool configs remain CJS where required (e.g., ESLint config as `*.cjs`).

### 3) Install strategy: one install per job, workspace-scoped commands

- Prefer a single workspace-aware install at repo root:
  - `npm ci`
- Run workspace commands via `npm -w <workspace> ...`.
- Avoid multiple independent installs (e.g., `npm ci` at root and again in `services/agent-api`) unless a tool truly requires it.

### 4) Caching: correctness over “best effort”

- If using `actions/setup-node` cache, set it consistently:
  - `cache: 'npm'`
  - `cache-dependency-path: package-lock.json`
- Only add additional lockfiles to `cache-dependency-path` if they actually exist.

## Phase 1 (Visibility): Module sanity checks (log-only)

### Objective

Catch dependency/module-resolution drift early without changing build outcomes.

### Approach

Add a cheap “module sanity” job to:

- PR CI workflows (pre-merge signal)
- main CI workflows (post-merge truth signal)

Keep the job **log-only** initially.

### Checks (mirror real failure modes)

Use ESM imports that match the actual class of failure (OpenAI helper importing Zod):

- `node -p "process.versions.node"`
- `node --input-type=module -e "await import('zod'); console.log('zod ok')"`
- `node --input-type=module -e "await import('openai/helpers/zod'); console.log('openai/helpers/zod ok')"`

### Non-blocking behavior

Use `continue-on-error: true` on steps to keep the workflow green while surfacing failures in the UI.

## Phase 2 (Unification): Node version + module-mode hygiene

### Objective

Eliminate drift in Node version selection and reduce implicit module-mode assumptions.

### Changes

- Convert all workflows to use `node-version-file: '.nvmrc'`.
- Normalize inline Node snippets:
  - If ESM features are used, require `--input-type=module`.

## Phase 3 (Determinism): Single install + workspace execution

### Objective

Ensure module resolution matches intended workspace context.

### Changes

- Prefer `npm ci` once at root.
- Use workspace-scoped commands:
  - `npm -w services/agent-api run ...`
  - or `working-directory: services/agent-api` when directly invoking `node src/...`.

### Allowed exceptions

- Tools that require additional installs or environment setup (e.g., Playwright browser install).

## Phase 4 (Guardrails): Mechanical enforcement

### Objective

Prevent regressions.

### Guardrail policy

- No `node -e` in workflows unless:
  - it is ESM-explicit via `node --input-type=module -e`, or
  - it is intentionally CommonJS and contains no ESM-only features.

### Enforcement

- Start with warn-only.
- Flip to blocking on PR CI when the repo is aligned.

## Notes

- The plan favors small PRs with one concern each.
- Changes that affect CI should be explicitly categorized as Fast CI (PR) vs Slow CI (nightly/main) when implemented.
