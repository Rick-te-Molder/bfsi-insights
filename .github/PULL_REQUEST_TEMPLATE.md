## Summary

<!-- Brief description of changes -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation
- [ ] CI/build

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

### SonarCloud fixes (if applicable)

- [ ] Updated `docs/architecture/quality/sonarcloud.md`:
  - [ ] Prevention Checklist item added (if new pattern)
  - [ ] Lessons Learned entry added
  - [ ] Rule Index entry added with link

### Data changes (if applicable)

- [ ] Uses `status_code` not `status` for pipeline queries
- [ ] Query logic matches other views of same data

### Prompt changes (if applicable)

- [ ] Migration added in `supabase/migrations/`
- [ ] Agent declared in `docs/agents/manifest.yaml`

## Remaining risks / unverified

<!-- List any untested scenarios or known limitations, or "none" -->
