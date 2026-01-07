# BFSI Insights Quality System (Code)

---

**Version**: 1.0.0  
**Last updated**: 2026-01-04  
**Change history**:

- 1.0.0 (2026-01-04): Initial baseline of the Quality System policy.

---

This document defines how we keep code quality high across the BFSI Insights monorepo—for both human contributors and synthetic coders (Windsurf/Cursor). It describes quality principles, a shared quality model, and concrete controls with evidence.

This is the single entry point for code-quality governance. All other coding practice documents link back here.

---

## 1. Purpose

We want predictable, maintainable, secure software that scales with:

- more features,
- more contributors,
- and more automation/synthetic coding.

This Quality System exists because bugs, incidents, and CI failures already happened, and we want durable prevention.

---

## 2. Repo structure and scope

Current top-level structure:

- `apps/admin/**` (Next.js admin app)
- `apps/web/**` (public web app)
- `services/agent-api/**` (backend/service)
- `infra/supabase/**` (Supabase project: migrations, policies, etc.)
- `packages/**` (shared packages)
- `scripts/**` (automation, CI helpers)
- `docs/**` (documentation; this system lives here)
- `reports/**` (generated reports/artifacts; not a source of truth)

This Quality System applies to all **source-of-truth** code and configuration in:

- `apps/**`
- `services/**`
- `infra/**`
- `packages/**`
- `scripts/**`

Generated/output folders (`dist/`, `coverage/`, `reports/`, `test-results/`, etc.) are out of scope except as evidence.

---

## 3. Normative sources (quality model)

We use these as the "why" and "what good looks like" behind our rules.

### 3.1 Product quality and maintainability

- **ISO/IEC 25000 family (SQuaRE)** as the high-level product quality model (dimensions).
- **SIG maintainability model** for subcharacteristics and practical norms (analyzability, modifiability, testability, modularity, reusability).
- **SonarCloud** as a consistent automated interpretation of many maintainability/reliability/security patterns.

### 3.2 Security (normative sources)

- **OWASP ASVS** (application security verification baseline)
- **OWASP Top 10** (risk awareness baseline)
- **OWASP Cheat Sheet Series** (secure coding patterns)
- **CWE Top 25** (common weakness taxonomy)
- **NIST SSDF** (secure software development process baseline)
- **OpenSSF / SLSA** (software supply-chain integrity baseline)

---

## 4. Quality principles

### 4.1 Quality is a product feature

Quality is not a clean-up task. We treat quality controls as part of feature work.

### 4.2 Small, composable units win

Smaller units improve analyzability, modifiability, and testability.

### 4.3 One source of truth (data + behavior)

If multiple views show the same data, they must use the same query logic and reference the same authoritative tables/config.

### 4.4 Evidence-based engineering

No claims like "fixed", "tests pass", "CI is green" without quoted evidence (command output or CI logs).

### 4.5 Prevent > detect > correct

We prefer preventive controls (rules, patterns) over relying only on detection (CI) and correction (incidents).

---

## 5. Quality dimensions and how we operationalize them

### 5.1 Maintainability (SIG focus)

We enforce:

- analyzability
- modifiability
- testability
- modularity
- reusability

Operationalization:

- local and CI quality gates (lint, tests, coverage, static analysis)
- refactoring practices that improve cohesion, reduce complexity, and reduce duplication
- clear module boundaries and predictable folder conventions

### 5.2 Reliability

We reduce defects via:

- automated tests and coverage where it matters
- fail-fast patterns for critical runtime state
- deterministic behavior for decision-critical flows where applicable

### 5.3 Security

We reduce risk via:

- secure coding baselines (OWASP/CWE/NIST/OpenSSF)
- static analysis and security hotspot review
- dependency and build integrity controls

### 5.4 Performance efficiency

We keep performance predictable via:

- consistent query patterns
- avoiding unnecessary client-side compute
- measuring before optimizing

---

## 6. Governance, controls, and accountability

### 6.1 Ownership and accountability

This Quality System is owned by the technical leadership of the repo. Ownership is about ensuring controls stay effective and standards stay clear.

Each control has:

- an **owner** (accountable for effectiveness),
- a **review cadence** (how often the control is reassessed),
- and an **escalation path** (what happens when it fails or is repeatedly violated).

**Definition of "repeated violations"**: ≥3 violations within a quarter, or any single violation with production impact.

### 6.2 Control framework (preventive / detective / corrective)

Controls are the system of checks that keep quality stable.

|  ID | Control                                               | Type              | Mechanism                                                                       | Source of truth                                             | Evidence                                |
| --: | ----------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
|  C1 | Boy Scout rule (touch → improve to current standards) | Prevent + Correct | Any touched file must meet current repo quality standards at commit time        | `/.windsurfrules` and this document                         | PR diff shows refactor in touched files |
|  C2 | Automated local gate(s) (pre-commit)                  | Detect            | Blocks commits when staged changes violate enforced standards                   | `scripts/ci/check-large-files.cjs` and other hooks          | hook output                             |
|  C3 | Synthetic coder operating rules                       | Prevent           | AI-specific rules + mandatory references                                        | `/.windsurfrules`                                           | PR diffs + adherence checks             |
|  C4 | Data consistency controls                             | Prevent           | "Single source of truth" patterns (status codes, query parity, taxonomy_config) | `docs/architecture/**` + code references                    | code diffs + tests                      |
|  C5 | Lint: zero errors + zero warnings                     | Detect            | Lint gate locally + CI                                                          | workspace scripts (e.g., `apps/admin`)                      | command output / CI logs                |
|  C6 | Tests + coverage (critical areas)                     | Detect            | Unit tests + coverage gates in Fast CI                                          | workspace scripts (e.g., `services/agent-api`)              | command output / CI logs                |
|  C7 | Static analysis (SonarCloud)                          | Detect + Prevent  | Continuous scanning + documented lesson lookup before fixing                    | `docs/architecture/quality/sonarcloud.md`                   | SonarCloud report + lesson file ref     |
|  C8 | CI tiering (Fast vs Slow)                             | Prevent           | Deterministic merge gates; move flaky steps to Slow CI                          | `.github/workflows/**`                                      | workflow diff + CI run                  |
|  C9 | Evidence policy ("no claims without proof")           | Prevent           | Required completion format and claim-to-evidence mapping                        | `/.windsurfrules` + this document (Section 8.3)             | PR comments                             |
| C10 | Prompt governance (manifest, migrations, fail-fast)   | Prevent + Detect  | CI validates prompt coverage; migrations for changes                            | `docs/agents/manifest.yaml`, `infra/supabase/migrations/**` | CI + migration diff                     |

### 6.3 Control ownership table

|  ID | Owner                         | Review cadence                          | Escalation path                                                        |
| --: | ----------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
|  C1 | Lead engineer                 | Quarterly and after repeated violations | tighten standards docs; add automation where possible                  |
|  C2 | DevOps/infra owner            | Quarterly and after false positives     | hotfix hook; add regression test for the checker                       |
|  C3 | Lead engineer                 | Monthly (early stage) then quarterly    | strengthen `.windsurfrules`; add automated check to C2 when detectable |
|  C4 | Domain owner (data/DB)        | Quarterly and after data incidents      | add tests; add lint/query helpers; update docs                         |
|  C5 | App owner (per workspace)     | Quarterly                               | adjust lint rules only via standards doc + PR                          |
|  C6 | Service owner (per workspace) | Quarterly                               | add tests; improve design; address root-cause patterns                 |
|  C7 | Lead engineer                 | Quarterly                               | update Sonar rules doc; prevent regressions with patterns              |
|  C8 | DevOps/infra owner            | Quarterly and after flaky runs          | move steps to Slow CI; fix caching; remove nondeterminism              |
|  C9 | Lead engineer                 | Quarterly                               | update evidence mapping; align with CI outputs                         |
| C10 | Agent/prompt owner            | Quarterly and after prompt incidents    | strengthen CI validation; enforce migration patterns                   |

Ownership names are roles, not individuals, to keep the policy stable across staffing changes.

### 6.4 Exception and deviation process

Quality standards are intentionally strict. Exceptions are rare and time-bounded.

When a standard cannot be met:

1. Document the exception close to the code or in the dedicated tracker.
2. State the reason (constraint, legacy migration, third-party behavior).
3. Link to a tracking issue for removal.
4. Set a review date. Exceptions expire unless renewed.

Standard exception annotation format:

```ts
// QUALITY-EXCEPTION: <control-or-standard-id>
// Reason: <why this cannot meet standard now>
// Review: <YYYY-MM-DD>
// Issue: <KB-XXX>
```

Central tracker:

- `docs/architecture/quality/exceptions.md`

---

## 7. Canonical documents and repo locations

### 7.1 Synthetic coder operating rules

- `/.windsurfrules`

Project-specific rules for Windsurf/Cursor.

### 7.2 Human-readable coding practices

- `docs/architecture/coding-practices.md`

Principle-driven practices and conventions.

### 7.3 Quality system (this document)

- `docs/architecture/quality-system.md`

Entry point for quality governance, controls, and evidence.

### 7.4 Quality standards (current + planned)

**Current**:

- `docs/architecture/sonarcloud-rules.md` (planned move to `docs/architecture/quality/sonarcloud.md`)

**Planned** (tracked in repo work):

- `docs/architecture/quality/maintainability.md`
- `docs/architecture/quality/security.md`
- `docs/architecture/quality/reliability.md`
- `docs/architecture/quality/performance.md`
- `docs/architecture/quality/testing.md`
- `docs/architecture/quality/ci-quality-gates.md`
- `docs/architecture/quality/sonarcloud.md`
- `docs/architecture/quality/lessons-learned.md`
- `docs/architecture/quality/exceptions.md`

### 7.5 Existing referenced docs (current)

- `docs/architecture/pipeline-status-codes.md`

Supabase project source of truth:

- `infra/supabase/**`

---

## 8. Required contributor behaviors

### 8.1 Onboarding (human + synthetic)

New contributors:

1. Read `/.windsurfrules` (mandatory for synthetic coders; normative for humans).
2. Read `docs/architecture/coding-practices.md`.
3. Review one recent PR that passed all gates to learn the expected evidence style.

### 8.2 Definition of Done (quality)

For any PR:

1. Touched code complies with the current quality standards (C1).
2. Local/CI gates pass for the touched workspace(s) (lint/tests/build/typecheck as applicable).
3. Static analysis gates (SonarCloud) do not regress or fail on new code.
4. PR communication includes required evidence for claims.

### 8.3 Evidence requirements (claim-to-evidence mapping)

| Claim                          | Required evidence                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| "Lint passes"                  | Output from `npm run lint -w <workspace>` showing 0 errors and 0 warnings, or CI job log excerpt    |
| "Tests pass"                   | Output from `npm test -w <workspace>` or CI job log excerpt                                         |
| "Coverage maintained/improved" | Coverage output for the touched workspace and targeted proof for touched files (e.g., grep excerpt) |
| "Build succeeds"               | Output from `npm run build -w <workspace>` or CI job log excerpt                                    |
| "No SonarCloud regression"     | SonarCloud PR decoration/result excerpt or linkable evidence in PR context                          |

Required reporting format:

```markdown
## Evidence

- **Lint**: <paste>
- **Tests**: <paste>
- **Coverage**: <paste>
- **Build**: <paste>
- **Static analysis**: <paste>

## Diff summary

- <files changed + why>

## Remaining risks / unverified

- none | <explicit list>
```

---

## 9. Control details (concrete)

### C1 — Boy Scout rule (touch → improve to current standards)

**Definition**:

- Any file that a contributor changes must be improved so it meets the current repository quality standards at commit time.

**Properties**:

- The Boy Scout rule does not define standards.
- The Boy Scout rule remains unchanged even when standards evolve.
- Standards are defined in `docs/architecture/quality/**` documents and enforced by automated gates where applicable.

### C2 — Automated local gate(s) (pre-commit)

Automated local checks block commits when enforced standards are violated.

**Source of truth**:

- `scripts/ci/check-large-files.cjs` (and any additional hook scripts)

**Recovery when a hook blocks commits due to a bug**:

1. Use `git commit --no-verify` only as part of a documented recovery.
2. Create a hotfix PR to repair the hook.
3. Document the recovery in the PR that used it.

### C3 — Synthetic coder operating rules (verification)

**Verification mechanisms**:

- **Structural**: `.windsurfrules` is the canonical rule set for AI assistants.
- **Behavioral**: PR review checks for violations (hardcoding, missing evidence, inconsistent queries, missing migrations, etc.).
- **Automated backstops**: pre-commit hooks and CI gates catch detectable violations.

**Escalation for repeated synthetic-coder violations**:

1. Strengthen `.windsurfrules` to make the rule explicit and unambiguous.
2. Add an automated check under C2 if the pattern is mechanically detectable.

### C4 — Data consistency controls

**Pipeline status queries**:

- Use `status_code` (numeric), not `status` (text).
- Load from `status_lookup` at runtime (no hardcoding).
- Reference: `services/agent-api/src/lib/status-codes.js`
- Docs: `docs/architecture/pipeline-status-codes.md`

**Query pattern consistency**:

- Same data must use identical query logic across UI views.
- No client-side filtering that contradicts DB-level filters.

**Taxonomy insertion**:

- Use `taxonomy_config` to drive junction inserts (no hardcoded tag types).
- Patterns live in `docs/architecture/quality/lessons-learned.md` (once created).

---

## 10. Metrics and system effectiveness

We measure whether controls are effective, not only whether they exist.

| Metric                                                        | Target           | Source                                    | Review cadence |
| ------------------------------------------------------------- | ---------------- | ----------------------------------------- | -------------- |
| SonarCloud maintainability rating (new code)                  | A                | SonarCloud                                | Per PR         |
| SonarCloud reliability rating (new code)                      | A                | SonarCloud                                | Per PR         |
| SonarCloud security rating (new code)                         | A                | SonarCloud                                | Per PR         |
| Unit test coverage (critical workspace: `services/agent-api`) | ≥80%             | CI                                        | Per PR         |
| CI failure rate (excluding intentional failures)              | Decreasing trend | GitHub Actions                            | Weekly         |
| Time to fix Critical/Blocker findings                         | <48 hours        | SonarCloud/issues                         | Weekly         |
| Count of time-bounded exceptions                              | Decreasing trend | `docs/architecture/quality/exceptions.md` | Monthly        |

Metrics output (generated artifacts) may be stored under:

- `reports/quality-metrics/**`

Reports are not sources of truth; they are evidence and trend data.

---

## 11. Control failure and recovery

When a control is unavailable or malfunctioning, recovery actions must be documented in the PR that uses them.

| Failure                | Impact                    | Recovery                                                           |
| ---------------------- | ------------------------- | ------------------------------------------------------------------ |
| Pre-commit hook bug    | Blocks commits            | Documented `--no-verify` + hotfix PR for the hook                  |
| SonarCloud outage      | No static analysis signal | Proceed only with documented risk; re-run/check when restored      |
| CI workflow broken     | PRs cannot merge          | Fix workflows in a dedicated PR; avoid mixing with product changes |
| Flaky tests in Fast CI | Merge gate instability    | Move to Slow CI or fix determinism; document decision              |

---

## 12. Change management: how the system evolves

### 12.1 Stable vs evolving

- **Stable**: principles and governance (this document, Boy Scout rule).
- **Evolving**: concrete standards and thresholds (`docs/architecture/quality/**`), and the automated checks that enforce them.

### 12.2 Adding new standards

Update standards when:

- an incident reveals a recurring pattern,
- CI failures repeat for a recognizable reason,
- review churn indicates unclear expectations.

Every new or updated standard must include:

- **Pattern prevented**: what bad outcome this stops
- **Root cause**: why the pattern was happening
- **Enforcement/check**: how it's detected or blocked
- **Reference**: issue/incident/PR that motivated the change

---

## 13. Implementation steps (repo hygiene)

- [x] Create `docs/architecture/quality-system.md` (this file)
- [x] Create folder `docs/architecture/quality/`
- [x] Create `docs/engineering/sonar/sonarcloud.md` (comprehensive version with Lessons Learned + Rules)
- [x] Create `docs/architecture/quality/exceptions.md` (empty tracker)
- [x] Create `docs/architecture/quality/lessons-learned.md` (general patterns from incidents)
- [ ] Update `/.windsurfrules` references to match canonical paths and control IDs
- [ ] Delete old `docs/architecture/sonarcloud-rules.md` after confirming new version is complete

---

## 14. Appendix: doc conventions

- Keep docs short, link-rich, and explicit about "source of truth".
- Put fast-changing "flags and fixes" in:
  - `docs/engineering/sonar/sonarcloud.md`
  - `docs/architecture/quality/lessons-learned.md`
- Keep principle docs stable:
  - `docs/architecture/coding-practices.md`
  - `docs/architecture/quality-system.md`
