## Summary

<!-- Brief description of changes -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation
- [ ] CI/build

## AI Assistance (if applicable)

<!-- If AI tools were used, document the collaboration -->

- **AI tool used**: <!-- Windsurf / Cursor / Copilot / None -->
- **Prompt summary**: <!-- Brief description of what you asked AI to do -->
- **Human verification**: <!-- What you manually verified beyond AI output -->

## Evidence

<!-- Required: paste command output or CI log excerpts -->

- **Lint**:
- **Tests**:
- **Build**:

## Quality Checklist

### General

- [ ] Code follows repo standards (files < 300 lines, functions < 30 lines)
- [ ] No hardcoded values that should come from config/DB
- [ ] Touched files improved to current standards (Boy Scout Rule - C1)

### Security (C12) - Required for auth/data/crypto changes

- [ ] No hardcoded secrets
- [ ] Input validated (Zod/schemas)
- [ ] Output encoded appropriately
- [ ] Authentication checked on protected routes
- [ ] Authorization verified server-side
- [ ] Errors don't expose internals

### SonarCloud fixes (if applicable)

- [ ] Updated `docs/engineering/sonar/sonarcloud.md`:
  - [ ] Prevention Checklist item added (if new pattern)
  - [ ] Lessons Learned entry added
  - [ ] Rule Index entry added with link

### Data changes (if applicable)

- [ ] Uses `status_code` not `status` for pipeline queries
- [ ] Query logic matches other views of same data

### Prompt changes (if applicable)

- [ ] Migration added in `supabase/migrations/`
- [ ] Agent declared in `docs/agents/manifest.yaml`

### New Dependencies (if applicable)

- [ ] Justified: why needed, alternatives considered
- [ ] Evaluated: actively maintained, no known vulnerabilities
- [ ] License compatible (MIT, Apache, etc.)

## Rollback Plan

<!-- How to revert if issues arise, or "Standard revert" -->

## Remaining risks / unverified

<!-- List any untested scenarios or known limitations, or "none" -->
