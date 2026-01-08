# AI-Assisted Development Guardrails

---

**Version**: 1.2.0  
**Last updated**: 2026-01-08  
**Quality System Controls**: C11-C22  
**Applies to**: All AI coding assistants (Windsurf, Cursor, Copilot) and human developers using AI tools

---

## 1. Purpose

AI-assisted coding accelerates development but introduces risks: architecture drift, security gaps, maintainability decay, and ownership ambiguity. This document establishes guardrails to capture AI productivity while maintaining engineering quality.

**Core principle**: AI is a pair programmer, not an autonomous developer. Human judgment remains accountable for all merged code.

## 2. The 14 Guidelines for AI-Assisted Development

These guidelines address failure modes observed in "vibe coding" — where AI output feels productive but quietly degrades system quality. They are organized into five categories.

---

### Category 1: Intent & Design Control

**Focus**: Prevent scope drift and architectural erosion.

#### Guideline 1: Requirements Integrity

**Risk**: AI "confidently drifts" beyond the stated requirement, touching unrelated code.

**Guardrails**:

- Write a one-screen spec before prompting: goal, non-goals, invariants, acceptance tests
- Require AI to output a change plan before touching code
- Review AI's proposed file list against requirements

**Example**:

```
❌ Bad: "Add vendor import" → AI also refactors auth middleware
✅ Good: "Add vendor import; do NOT touch auth; acceptance: rejects invalid CSV"
```

#### Guideline 2: Architecture Integrity

**Risk**: AI creates working code that violates layer boundaries, creating tight coupling.

**Guardrails**:

- Maintain architecture docs in-repo (`docs/architecture/overview.md`)
- Add boundary checks to CI (eslint-plugin-boundaries or custom)
- AI must follow: route → service → repository pattern

**Example**:

```
❌ Bad: Database queries in React components
✅ Good: Component → Server Action → Service → Supabase client
```

#### Guideline 3: API & Contract Stability

**Risk**: AI "refactors" a function and silently changes return shape, breaking callers.

**Guardrails**:

- Use schemas as truth (Zod, TypeScript interfaces)
- Add contract tests for critical APIs
- Version APIs; document breaking changes

**Example**:

```
❌ Bad: AI changes function signature without updating callers
✅ Good: Contract test fails; PR includes migration or compat shim
```

**🚨 HARD RULE: Boundary Validation Gate (C20)**

> **No new public surface (HTTP endpoint, webhook, CLI command) may be merged without schema validation AND negative tests.**

- **Requirement**: Every boundary surface must have Zod schema validation
- **Enforcement**: PR checklist item; CI schema coverage check (planned)
- **Pattern**: Validation at entry point, reject early with structured errors
- **Tests**: At least one "malicious/invalid payload" test per endpoint

```typescript
// ✅ Required pattern: validate at boundary
const schema = z.object({ id: z.string().uuid(), limit: z.number().int().positive() });
export async function handler(req: Request) {
  const result = schema.safeParse(await req.json());
  if (!result.success) return Response.json({ error: result.error }, { status: 400 });
  // ... proceed with validated data
}
```

#### Guideline 4: Documentation Coherence

**Risk**: AI accelerates code changes but not documentation; system becomes untraceable.

**Guardrails**:

- Require Architecture Decision Records (ADR) for architectural choices
- Update runbooks when touching operations
- README updates in same PR as structure changes

**Example**:

```
❌ Bad: System works but nobody knows "what connects to what"
✅ Good: ADR explains why; runbook explains how to debug
```

---

### Category 2: Safety & Risk Control

**Focus**: Security, privacy, data integrity, and production blast radius.

#### Guideline 5: Security by Default

**Risk**: AI generates "working" code that is insecure (XSS, injection, auth bypass).

**Guardrails**:

- Security checklist required on PRs (see `docs/engineering/secure-coding.md`)
- Human review required for: auth, crypto, data access, deserialization
- Static analysis (SonarCloud) blocks security hotspots

**Example**:

```
❌ Bad: AI writes innerHTML without sanitization
✅ Good: Uses DOMPurify, CSP headers, output encoding
```

**🚨 HARD RULE: SQL Safety Gate (C19)**

> **No dynamic SQL without parameterization. String-concatenated SQL is a merge blocker.**

- **Banned**: Template literals or string concatenation in SQL context (`... ${userInput} ...`)
- **Required**: Parameterized queries via Supabase client, prepared statements, or vetted query builder
- **Enforcement**: Semgrep/ESLint rules flag SQL injection patterns; CI blocks on detection
- **Review**: Any raw SQL requires explicit security review approval

```typescript
// ❌ BANNED - merge blocker
const query = `SELECT * FROM users WHERE name = '${userInput}'`;

// ✅ REQUIRED - parameterized via Supabase
const { data } = await supabase.from('users').select('*').eq('name', userInput);

// ✅ ALLOWED - parameterized prepared statement (if raw SQL needed)
const { data } = await supabase.rpc('search_users', { search_term: userInput });
```

**🚨 HARD RULE: Secrets Gate (C21)**

> **Secret scanning is a merge gate. No exceptions. Hardcoded credentials block the PR.**

- **Banned**: API keys, passwords, tokens, connection strings in source code
- **Required**: Secrets via environment variables or secret manager only
- **Enforcement**: Pre-commit secret scanning + CI secret detection blocks merge
- **Pattern**: Config module reads env; runtime fails fast if missing

```typescript
// ❌ BANNED - merge blocker
const API_KEY = 'sk-1234567890abcdef';
const supabase = createClient(url, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');

// ✅ REQUIRED - env-based config
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY environment variable is required');
```

**Safe Config Pattern** (use this template):

```typescript
// lib/config.ts - sanctioned pattern for all secrets
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseKey: requireEnv('SUPABASE_ANON_KEY'),
  openaiKey: requireEnv('OPENAI_API_KEY'),
} as const;
```

#### Guideline 6: Data Safety & Migration Discipline

**Risk**: AI makes destructive schema changes in one PR, bricking the database.

**Guardrails**:

- Enforce expand → backfill → contract pattern
- Require rollback notes in migrations
- Block destructive keywords (DROP, TRUNCATE) without explicit approval

**Example**:

```
❌ Bad: DROP COLUMN and rewrite queries in one PR
✅ Good: Add new column → dual-write → backfill → switch reads → remove old
```

#### Guideline 7: Operational Safety

**Risk**: AI ships risky changes directly to production.

**Guardrails**:

- Feature flags for risky behavior
- Canary new flows; gradual rollout
- Default to safe fallbacks (timeouts, circuit breakers)

**Example**:

```
❌ Bad: New ingestion path ships directly to prod
✅ Good: Flag-gated; gradual rollout; auto-rollback on error budget breach
```

#### Guideline 8: Deterministic Build

**Risk**: AI introduces build steps that only work in its environment.

**Guardrails**:

- Pin Node/tool versions in repo
- CI uses same scripts as local
- Document environment setup

**Example**:

```
❌ Bad: Works locally but fails in CI due to env mismatch
✅ Good: CI and local use identical commands; no hidden prerequisites
```

_Note: Also relates to Category 3 (Quality & Maintainability)._

---

### Category 3: Quality & Maintainability

**Focus**: Keep codebase healthy under high change volume.

#### Guideline 9: Code Health Controls

**Risk**: AI produces large PRs that nobody fully understands; review becomes ineffective.

**Guardrails**:

- Hard limits: files < 300 lines, functions < 30 lines
- PR diff budget: warn > 500 lines, block > 1000 lines
- "Refactor or explain" for new patterns

**Example**:

```
❌ Bad: 1000-line PR with mixed concerns
✅ Good: Split into focused PRs; each adds tests + docs
```

#### Guideline 10: Test Strategy

**Risk**: AI breaks edge cases; "it ran locally once" is not verification.

**Guardrails**:

- Test-first for features: write failing test → implement → verify green
- Coverage delta check prevents regression
- At least one test type per PR (unit/integration/e2e)

**Example**:

```
❌ Bad: "Tests pass" without new tests for new code
✅ Good: Failing test added first; PR shows it turning green
```

#### Guideline 11: Reviewability & Change Control

**Risk**: Huge AI PRs shift review burden; reviewers rubber-stamp without understanding.

**Guardrails**:

- PR template with intent, risk, test evidence
- Diff budget enforced (see Guideline 9)
- Reviewers must be able to reason about changes in 15-30 minutes

**Example**:

```
❌ Bad: 2000-line PR with "AI did it"
✅ Good: 200-line PR with clear intent and verification
```

_Note: Also strongly relates to Category 5 (Evidence & Accountability)._

---

### Category 4: Integrity of Inputs (Dependencies & Tooling)

**Focus**: Prevent supply-chain and agent-tool misuse.

#### Guideline 12: Dependency & Supply-Chain Hygiene

**Risk**: AI adds unmaintained or vulnerable packages without justification.

**Guardrails**:

- New dependencies require justification in PR
- npm audit / Snyk in CI blocks high/critical vulns
- License compliance checked

**Example**:

```
❌ Bad: AI adds random CSV parser with no maintenance
✅ Good: Choose vetted library; document why; add to approved list
```

**🚨 HARD RULE: Dependency Governance Gate (C22)**

> **No new dependency without justification checklist AND deterministic install proof.**

- **Banned**: AI silently adding packages; hallucinated package names
- **Required**: Justification (why needed, alternatives considered, maintenance status, license)
- **Enforcement**: CI fails if `package.json` changed without lockfile update; `npm ci` must succeed
- **Pattern**: AI proposes dependency; human reviews and approves before adding

**Dependency Addition Checklist** (required in PR):

```markdown
## New Dependency: [package-name]

- [ ] **Why needed**: [specific use case]
- [ ] **Alternatives considered**: [what else was evaluated]
- [ ] **Maintenance**: [last release date, weekly downloads, open issues]
- [ ] **License**: [license type, compatible with project]
- [ ] **Security**: [no known vulnerabilities, npm audit clean]
- [ ] **Size impact**: [bundle size delta]
```

**CI Enforcement**:

```yaml
# Dependency hygiene check
- name: Verify lockfile
  run: |
    if git diff --name-only HEAD~1 | grep -q 'package.json'; then
      git diff --name-only HEAD~1 | grep -q 'package-lock.json' || exit 1
    fi
- name: Clean install
  run: npm ci # Fails if lockfile doesn't match package.json
```

#### Guideline 13: Prompt & Toolchain Governance

**Risk**: AI runs sweeping commands, deletes files, changes configs without review.

**Guardrails**:

- Approved prompt templates in `.windsurf/workflows/`
- Tool restrictions: read-only by default; explicit allow for destructive ops
- AI proposes commands; human executes

**Example**:

```
❌ Bad: AI runs `rm -rf` or modifies .env
✅ Good: AI proposes changes; human reviews and executes
```

---

### Category 5: Evidence & Accountability

**Focus**: Prove what changed, why, and that it's safe.

#### Guideline 14: Evidence-Based Development

**Risk**: "AI made changes; looks fine" — no traceability of intent or verification.

**Guardrails**:

- Store prompt summary in PR description
- Required "What I verified" section
- Link to tests run, manual checks performed

**Example**:

```
❌ Bad: "Refactored per AI suggestion"
✅ Good: "Prompt: extract helper; files: A/B; tests: T1/T2; verified: behavior X"
```

_Note: Guideline 11 (Reviewability & Change Control) also strongly supports this category._

---

## 3. Controls Framework

These guardrails are operationalized as Quality System controls:

| ID  | Control                      | Type    | Enforcement                  |
| --- | ---------------------------- | ------- | ---------------------------- |
| C11 | Plan-first prompting         | Prevent | `.windsurfrules` + PR review |
| C12 | Security-by-default          | Prevent | PR template + pre-commit     |
| C13 | Dependency hygiene           | Detect  | Pre-commit + CI              |
| C14 | Prompt governance            | Prevent | `.windsurfrules`             |
| C15 | Architecture boundaries      | Detect  | CI (planned)                 |
| C16 | PR diff budget               | Detect  | CI (planned)                 |
| C17 | ADR requirement              | Prevent | PR review                    |
| C18 | Feature flag guidance        | Prevent | PR review                    |
| C19 | **SQL Safety Gate**          | Block   | Semgrep/ESLint + CI          |
| C20 | **Boundary Validation Gate** | Block   | PR checklist + CI (planned)  |
| C21 | **Secrets Gate**             | Block   | Pre-commit + CI              |
| C22 | **Dependency Governance**    | Block   | CI lockfile + npm ci         |

---

## 4. Plan-First Prompting (C11)

Before asking AI to write code, create a brief spec:

```markdown
## Goal

[One sentence: what should exist after this change?]

## Non-Goals

[What this change does NOT include]

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
- [ ] Test for scenario Y
```

**Workflow**:

1. Write spec (above)
2. Ask AI to review spec and propose implementation plan
3. Review AI's plan against spec
4. Only then: ask AI to implement
5. Verify against acceptance criteria

---

## 5. Security Review Requirements (C12)

### 5.1 Triggers

The following changes **require explicit security review**:

| Change Type             | Reviewer   | Checklist          |
| ----------------------- | ---------- | ------------------ |
| Authentication logic    | Senior dev | Security checklist |
| Authorization/RLS       | Senior dev | RLS audit          |
| Cryptography            | Senior dev | Security checklist |
| File handling           | Any dev    | Security checklist |
| External API            | Any dev    | API security       |
| AI-generated code (any) | Any dev    | Security checklist |

### 5.2 Security Checklist

```markdown
## Security Review

### 🚨 Mandatory Security Gates (merge blockers)

- [ ] **C19 SQL Safety**: No string-concatenated SQL; all queries parameterized
- [ ] **C20 Boundary Validation**: New endpoints have Zod schemas + negative tests
- [ ] **C21 Secrets**: No hardcoded credentials; secrets via env only
- [ ] **C22 Dependencies**: New deps have justification; lockfile updated

### Code Review

- [ ] No hardcoded secrets
- [ ] Input validated (Zod/schemas)
- [ ] Output encoded appropriately
- [ ] SQL uses Supabase client (parameterized)
- [ ] Errors don't expose internals

### Access Control

- [ ] Authentication checked on protected routes
- [ ] Authorization verified server-side
- [ ] RLS policies cover new tables/columns

### Data Handling

- [ ] Sensitive data not logged
- [ ] File uploads validated (type, size)
- [ ] External calls have timeouts
```

---

## 6. Dependency Hygiene (C13)

### 6.1 Adding New Dependencies

Before adding a dependency:

1. **Justify**: Why is this needed? Can we use existing deps?
2. **Evaluate**: Maintenance status, security history, license
3. **Document**: Add justification to PR description

### 6.2 Pre-Commit Check

The pre-commit hook (`scripts/ci/check-new-dependencies.cjs`) warns when `package.json` changes include new dependencies without justification.

### 6.3 CI Enforcement

- `npm audit` runs on every PR
- High/Critical vulnerabilities block merge
- Dependabot alerts monitored weekly

---

## 7. Prompt Governance (C14)

### 7.1 Approved Prompt Patterns

Located in `.windsurf/workflows/`:

| Workflow             | Purpose                         |
| -------------------- | ------------------------------- |
| `plan-first.md`      | Require planning before coding  |
| `ai-coding-rules.md` | General AI coding constraints   |
| `test-first.md`      | Test-driven development with AI |

### 7.2 AI Coding Rules

AI assistants must follow `.windsurfrules`:

```
## AI-Assisted Development Rules

1. **Plan first**: Output a change plan before writing code
2. **Respect boundaries**: Follow architecture layers (route → service → repo)
3. **Add tests**: Every feature/fix includes tests
4. **No broad refactors**: Don't refactor beyond the stated goal
5. **Flag security**: Explicitly note when touching auth/crypto/data access
6. **Log intent**: Include prompt summary in commit messages
7. **Propose, don't execute**: Propose destructive commands; wait for approval
```

### 7.3 Tool Restrictions

| Operation                | Default    | Override               |
| ------------------------ | ---------- | ---------------------- |
| Read files               | ✅ Allowed | —                      |
| Write files              | ✅ Allowed | —                      |
| Run safe commands        | ✅ Allowed | —                      |
| Run destructive commands | ❌ Blocked | Explicit user approval |
| Modify .env              | ❌ Blocked | Explicit user approval |
| Delete files             | ⚠️ Warn    | User confirmation      |

---

## 8. Evidence Requirements

### 8.1 PR Description Format

```markdown
## Summary

[What this PR does]

## AI Assistance

- **Prompt**: [Summary of what was asked]
- **AI tool**: [Windsurf/Cursor/Copilot]
- **Human verification**: [What you manually verified]

## Changes

### Files Created

- `path/to/new.ts` - purpose

### Files Modified

- `path/to/existing.ts` - what changed

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Edge cases considered

## Security Checklist

- [ ] No hardcoded secrets
- [ ] Input validation in place
- [ ] Auth/authz verified (if applicable)

## Rollback Plan

[How to revert if issues arise]
```

### 8.2 Commit Message Format

```
<type>(<scope>): <subject>

## What changed
- Brief description

## Files
- `path/to/file.ts` - change description

## AI context
- Prompt: [brief summary of AI prompt used]
- Verified: [what was manually verified]
```

---

## 9. Implementation Status

| Control                          | Status         | Enforcement       |
| -------------------------------- | -------------- | ----------------- |
| C11 Plan-first                   | ✅ Implemented | `.windsurfrules`  |
| C12 Security checklist           | ✅ Implemented | PR template       |
| C13 Dependency check             | ✅ Implemented | Pre-commit        |
| C14 Prompt governance            | ✅ Implemented | `.windsurfrules`  |
| C15 Architecture boundaries      | 🔲 Planned     | CI                |
| C16 PR diff budget               | 🔲 Planned     | CI                |
| C17 ADR requirement              | 🔲 Planned     | PR review         |
| C18 Feature flags                | 🔲 Planned     | PR review         |
| **C19 SQL Safety Gate**          | 🔲 Planned     | Semgrep/ESLint+CI |
| **C20 Boundary Validation Gate** | 🔲 Planned     | PR checklist + CI |
| **C21 Secrets Gate**             | ✅ Implemented | Pre-commit + CI   |
| **C22 Dependency Governance**    | ✅ Implemented | Pre-commit + CI   |

---

## 10. References

### 10.1 Industry Context

This framework addresses risks documented in:

- "The Vibe Coding Trap" — architecture drift from AI-assisted development
- NIST SSDF — secure software development fundamentals
- OWASP — AI-generated code security findings
- Veracode/Apiiro — AI code quality and security research

### 10.2 Related Documents

- `docs/engineering/quality-system.md` — Quality governance entry point
- `docs/engineering/coding-practices.md` — General coding standards
- `docs/engineering/secure-coding.md` — Security guidelines
- `docs/security/` — Security policy, threat analysis, design
- `.windsurfrules` — AI assistant operating rules

---

## Appendix A: Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│              AI-ASSISTED DEVELOPMENT CHECKLIST              │
├─────────────────────────────────────────────────────────────┤
│ 🚨 MANDATORY SECURITY GATES (merge blockers)                 │
│ ■ C19: No string-concatenated SQL (parameterize all)        │
│ ■ C20: New endpoints have schema validation + negative tests │
│ ■ C21: No hardcoded secrets (env vars only)                  │
│ ■ C22: New deps have justification + lockfile updated        │
├─────────────────────────────────────────────────────────────┤
│ BEFORE PROMPTING                                            │
│ □ Write spec: goal, non-goals, acceptance criteria          │
│ □ Identify files to change                                  │
│ □ Note security-sensitive areas                             │
├─────────────────────────────────────────────────────────────┤
│ DURING DEVELOPMENT                                          │
│ □ Review AI's plan before accepting code                    │
│ □ Check AI stayed within stated scope                       │
│ □ Verify architecture boundaries respected                  │
│ □ Add tests for new/changed functionality                   │
├─────────────────────────────────────────────────────────────┤
│ BEFORE COMMITTING                                           │
│ □ Run pre-commit hooks (lint, tests, checks)                │
│ □ Security self-check if touching auth/data                 │
│ □ Include AI context in commit message                      │
├─────────────────────────────────────────────────────────────┤
│ PR REQUIREMENTS                                             │
│ □ Summary + AI assistance section                           │
│ □ Files changed with descriptions                           │
│ □ Security checklist completed                              │
│ □ Test evidence provided                                    │
│ □ Rollback plan documented                                  │
└─────────────────────────────────────────────────────────────┘
```

## Appendix B: Change History

| Version | Date       | Changes                                                                  |
| ------- | ---------- | ------------------------------------------------------------------------ |
| 1.2.0   | 2026-01-08 | Add 4 mandatory security gates (C19-C22): SQL, secrets, validation, deps |
| 1.1.0   | 2026-01-08 | Reorganize 14 dimensions into 5 categories; rename to guidelines         |
| 1.0.0   | 2026-01-07 | Initial version with 14 dimensions, controls C11-C18                     |
