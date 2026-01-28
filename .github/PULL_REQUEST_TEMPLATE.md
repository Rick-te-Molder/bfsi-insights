## Summary

<!--
Write this like a short human summary.

### Problem
1–2 sentences: what was broken / risky / confusing?

### Fix
1–2 sentences: what did you change?

### Result
1 sentence: what is better now (behavior change, risk reduced, etc.)?
-->

## Root cause

<!-- Required for bug fixes. Otherwise: N/A -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation
- [ ] CI/build

## Files changed

<!-- Always list the main files and why they changed (review speed + archaeology). -->

- `path/to/file` - what changed / why

## AI Assistance (if applicable)

<!-- If AI tools were used, document the collaboration -->

- **AI tool used**: <!-- Windsurf / Cursor / Copilot / None -->
- **Prompt summary**: <!-- Brief description of what you asked AI to do -->
- **Human verification**: <!-- What you manually verified beyond AI output -->
- [ ] **Shell-safe PR creation**: PR body was not inlined into a shell command; it was created using a shell-safe method (e.g., `gh --body-file` or a quoted heredoc) to avoid zsh interpreting markdown/globs

## Evidence

<!-- Required: paste command output or CI log excerpts -->
<!-- Prefer 1–3 lines per command. If you did not run something, say why. -->

- **PR Gate (`npm run pr:check`)**:
- **Lint**:
- **Tests**:
- **Build**:

## Quality Checklist

<!-- If a section below is not applicable, explicitly write "N/A" in that section. -->

### General

- [ ] Code follows repo standards (files < 300 lines, functions < 30 lines)
- [ ] No hardcoded values that should come from config/DB
- [ ] Touched files improved to current standards (Boy Scout Rule - C1)

<details>
<summary>Security (C12) - required for auth/data/crypto changes</summary>

- [ ] N/A
- [ ] No hardcoded secrets
- [ ] Input validated (Zod/schemas)
- [ ] Output encoded appropriately
- [ ] Authentication checked on protected routes
- [ ] Authorization verified server-side
- [ ] Errors don't expose internals
</details>

<details>
<summary>SonarCloud fixes (if applicable)</summary>

- [ ] N/A
- [ ] Updated `docs/engineering/sonar/sonarcloud.md`:
  - [ ] Prevention Checklist item added (if new pattern)
  - [ ] Lessons Learned entry added
  - [ ] Rule Index entry added with link
  </details>

<details>
<summary>Data changes (if applicable)</summary>

- [ ] N/A
- [ ] Uses `status_code` not `status` for pipeline queries
- [ ] Query logic matches other views of same data
</details>

<details>
<summary>Prompt changes (if applicable)</summary>

- [ ] N/A
- [ ] Migration added in `supabase/migrations/`
- [ ] Agent declared in `docs/agents/manifest.yaml`
</details>

<details>
<summary>New Dependencies (if applicable)</summary>

- [ ] N/A
- [ ] Justified: why needed, alternatives considered
- [ ] Evaluated: actively maintained, no known vulnerabilities
- [ ] License compatible (MIT, Apache, etc.)
</details>

## Rollback Plan

<!-- How to revert if issues arise, or "Standard revert" -->

## Remaining risks / unverified

<!-- List any untested scenarios or known limitations, or "none" -->

## PR Reference

<!-- Auto-filled by GitHub, but include for issue tracking -->

**PR**: #<!-- PR number will be auto-filled -->
**Link**: <!-- https://github.com/Rick-te-Molder/bfsi-insights/pull/XXX -->
