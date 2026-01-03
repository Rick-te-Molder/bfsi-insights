# Repo Layout Improvements Plan

## Goal

Improve repository structure for safety, clarity, and maintainability without unnecessary churn. Focus on operational risk reduction and monorepo ergonomics.

## Principles

1. **Safety over aesthetics** — Changes should reduce risk (e.g., accidental prod SQL), not just look cleaner.
2. **Minimal churn** — Prefer low-effort changes with high clarity payoff.
3. **Enforce over document** — CI guardrails are better than hoping developers read READMEs.
4. **Responsibility-scoped packages** — Avoid generic "shared" grab-bags.

---

## Current Issues

### 1. Root-level SQL files

**Problem**: 9 ad-hoc `.sql` files at repo root with unclear lifecycle (one-time fixes? recurring ops? failed migrations?).

**Risk**: Accidental execution against production; no audit trail.

### 2. Scripts folder is a mixed bag

**Problem**: `scripts/` contains CI checks, developer utilities, data ops, and SQL with no clear separation.

**Risk**: Developers don't know which scripts are safe to run locally.

### 3. Duplicate workspace lockfiles

**Problem**: `admin-next/package-lock.json` exists alongside root lockfile.

**Risk**: Defeats npm workspaces semantics; causes version drift and slower CI.

### 4. Ambiguous `src/` directory

**Problem**: Root `/src/` is the Astro public site, but name suggests shared code in a monorepo.

**Risk**: Confusion for new contributors.

### 5. No shared runtime package

**Problem**: `packages/types/` exists, but no shared runtime utilities.

**Risk**: Duplication of logging, error handling, retry logic across services.

---

## Phased Implementation

### Phase 1: SQL Hygiene (PR #1)

**Objective**: Make SQL scripts safe and auditable.

#### Changes

1. Create directory structure:

   ```
   scripts/sql/
   ├── one-time/     # Scripts run once, kept for audit
   ├── ops/          # Recurring operational queries
   └── README.md     # Explains categories + naming conventions
   ```

2. Move root `.sql` files:
   - One-time fixes → `scripts/sql/one-time/YYYY-MM-DD-ticket-purpose.sql`
   - Recurring queries → `scripts/sql/ops/`

3. Add `scripts/run-sql.mjs` wrapper with:
   - `--env=local|staging|prod` flag (required for ops/)
   - `DRY_RUN=1` default
   - Confirmation prompt for prod
   - Logging: timestamp, git commit, operator

4. Add `scripts/sql/README.md`:
   - Naming conventions
   - Required header comments (intent, expected rows, rollback)
   - How to use `run-sql.mjs`

#### Files to move

| Current location                  | New location                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `check-audiences.sql`             | `scripts/sql/ops/check-audiences.sql`                                    |
| `check-geographies.sql`           | `scripts/sql/ops/check-geographies.sql`                                  |
| `check-status-300.sql`            | `scripts/sql/ops/check-status-300.sql`                                   |
| `check-tagger-version.sql`        | `scripts/sql/ops/check-tagger-version.sql`                               |
| `fix-article-enrichment-meta.sql` | `scripts/sql/one-time/2025-XX-XX-kb-XXX-fix-article-enrichment-meta.sql` |
| `fix-missing-tags.sql`            | `scripts/sql/one-time/2025-XX-XX-kb-XXX-fix-missing-tags.sql`            |
| `retag-items.sql`                 | `scripts/sql/ops/retag-items.sql`                                        |
| `validate-schema-changes.sql`     | `scripts/sql/ops/validate-schema-changes.sql`                            |
| `validate-schema-simple.sql`      | `scripts/sql/ops/validate-schema-simple.sql`                             |

---

### Phase 2: Scripts Reorg (PR #2)

**Objective**: Clear separation of script purpose and safety level.

#### Changes

1. Create directory structure:

   ```
   scripts/
   ├── ci/           # Called by GitHub Actions; deterministic, no prod access
   ├── dev/          # Local developer utilities; safe, dry-run default
   ├── ops/          # May touch production; requires explicit env selection
   ├── sql/          # (from Phase 1)
   ├── lib/          # Shared script utilities
   └── README.md     # Index with safety labels
   ```

2. Move existing scripts:
   - `check-large-files.cjs` → `scripts/ci/`
   - `check-prompt-coverage.js` → `scripts/ci/`
   - `check-workflow-node-inline-esm.mjs` → `scripts/ci/`
   - `dump-schema.mjs` → `scripts/dev/`
   - `view-schema.mjs` → `scripts/dev/`
   - `check-links.mjs` → `scripts/dev/`
   - `check-stale-items.mjs` → `scripts/ops/`
   - etc.

3. Add `scripts/README.md`:

   ```markdown
   ## Safety Labels

   | Directory | Safe to run locally? | Touches prod? | Notes                    |
   | --------- | -------------------- | ------------- | ------------------------ |
   | `ci/`     | ✅ Yes               | ❌ No         | Called by GitHub Actions |
   | `dev/`    | ✅ Yes               | ❌ No         | Developer utilities      |
   | `ops/`    | ⚠️ Careful           | ✅ Yes        | Requires --env flag      |
   | `sql/`    | ⚠️ Careful           | ✅ Yes        | Use run-sql.mjs          |
   ```

4. Standardize file extensions:
   - `.mjs` for ESM scripts (preferred)
   - `.cjs` only where tooling requires CommonJS

---

### Phase 3: Monorepo Enforcement (PR #3)

**Objective**: Enforce single-lockfile semantics via CI.

#### Changes

1. Delete `admin-next/package-lock.json`

2. Add CI check in `ci.yml` and `ci-main.yml`:

   ```yaml
   - name: Check for stray lockfiles
     run: |
       STRAY=$(find . -name 'package-lock.json' -not -path './package-lock.json' -not -path './node_modules/*')
       if [ -n "$STRAY" ]; then
         echo "ERROR: Found package-lock.json outside root:"
         echo "$STRAY"
         exit 1
       fi
   ```

3. Verify `npm ci` still works from root after deletion

---

### Phase 4: Clarity (PR #4)

**Objective**: Make repo structure self-documenting.

#### Changes

1. Rename `src/` → `site/`
   - Update `astro.config.mjs` paths
   - Update any import references
   - Update root `README.md` project structure

2. Add `docs/repo-map.md`:

   ```markdown
   # Repository Map

   ## Surfaces

   | Surface         | Location              | Runtime            | Start command                     |
   | --------------- | --------------------- | ------------------ | --------------------------------- |
   | Public website  | `site/`               | Astro (Cloudflare) | `npm run dev`                     |
   | Admin dashboard | `admin-next/`         | Next.js (Vercel)   | `npm run dev -w admin-next`       |
   | Agent API       | `services/agent-api/` | Node.js (Render)   | `npm start -w services/agent-api` |

   ## Shared code

   | Package           | Purpose                 |
   | ----------------- | ----------------------- |
   | `packages/types/` | Shared TypeScript types |

   ## Infrastructure

   | Location               | Purpose                               |
   | ---------------------- | ------------------------------------- |
   | `supabase/migrations/` | Database migrations (source of truth) |
   | `supabase/functions/`  | Edge functions                        |
   | `.github/workflows/`   | CI/CD pipelines                       |

   ## Scripts

   See `scripts/README.md` for safety labels and usage.
   ```

---

### Phase 5: First Shared Package (Deferred)

**Objective**: Establish pattern for shared runtime code.

#### Changes

1. Create `packages/ops/`:

   ```
   packages/ops/
   ├── src/
   │   ├── logger.ts      # Structured logging
   │   ├── errors.ts      # Error types, wrapping
   │   ├── retry.ts       # Retry with backoff
   │   └── index.ts
   ├── package.json
   └── tsconfig.json
   ```

2. Migrate first consumer (`services/agent-api/`) to use it

3. Document pattern in `packages/README.md`:
   - Packages are responsibility-scoped (not a generic "shared" grab-bag)
   - Each package has a clear owner and purpose

---

## Explicitly Not Included

| Item                              | Reason                                       |
| --------------------------------- | -------------------------------------------- |
| Config consolidation (`/config/`) | Breaks tooling expectations; no real benefit |
| Full `apps/` migration            | High churn for unclear payoff now            |
| Test directory restructuring      | Each workspace already owns its tests        |
| Dependency boundary enforcement   | Good idea, but higher effort; add later      |

---

## Success Criteria

- [ ] No `.sql` files at repo root
- [ ] `scripts/run-sql.mjs` prevents accidental prod execution
- [ ] `scripts/README.md` documents safety levels
- [ ] CI fails if `package-lock.json` found outside root
- [ ] `src/` renamed to `site/`
- [ ] `docs/repo-map.md` exists as reference architecture landing page
