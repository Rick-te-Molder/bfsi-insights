# SonarCloud Quality Standards

---

**Version**: 1.1.0  
**Last updated**: 2026-01-04  
**Quality System Control**: C7 (Static analysis)  
**Change history**:

- 1.1.0 (2026-01-04): Restructured to Prevention Checklist + Lessons Learned + Rule Index (no duplication of SonarSource docs).
- 1.0.0 (2026-01-04): Initial version.

---

This document captures SonarCloud patterns we've encountered and how to prevent them.

**Update policy**: This document MUST be updated every time we solve a SonarCloud issue:

1. Update the Prevention Checklist if a new pattern emerges
2. Add a Lessons Learned entry with our fix pattern
3. Add the rule to the Rule Index with a link to SonarSource

**Full rule catalog**: [SonarSource TypeScript Rules]
https://rules.sonarsource.com/typescript/ | 427 rules
https://rules.sonarsource.com/javascript/ | 422 rules
https://rules.sonarsource.com/githubactions/ | 26 rules

---

# Prevention Checklist

Quick checks before committing. If you're about to write any of these patterns, stop and refactor.

- [ ] **No nested ternaries** — Extract to helper function with early returns
- [ ] **No boolean selector parameters** — Use separate methods or union types
- [ ] **Interactive handlers on interactive elements only** — Use `<button>`, not `<div onClick>`
- [ ] **No code duplication** — Extract shared logic to functions/components
- [ ] **No overly complex functions** — Keep cyclomatic complexity low

---

# Lessons Learned

Project-specific patterns derived from fixing real issues. Each entry shows what to do in our codebase.

---

## [Extract nested ternary operations into helper functions](./sonar-lessons/extract-nested-ternary-operations-into-helper-functions.md)

---

## [Provide multiple methods instead of boolean selector parameters](./sonar-lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md)

---

## [Use native interactive elements or add proper ARIA roles](./sonar-lessons/use-native-interactive-elements-or-add-proper-aria-roles.md)

---

# Rule Index

Rules we've encountered. Links to authoritative SonarSource documentation.

## [Ternary operators should not be nested](./sonar-rules/ternary-operators-should-not-be-nested.md)

---

## [Methods should not contain selector parameters](./sonar-rules/methods-should-not-contain-selector-parameters.md)

---

## [Non-interactive elements should not have interactive handlers](./sonar-rules/non-interactive-elements-should-not-have-interactive-handlers.md)

---

## [Non-interactive DOM elements should not have interactive ARIA roles](./sonar-rules/non-interactive-dom-elements-should-not-have-interactive-aria-roles.md)

---
