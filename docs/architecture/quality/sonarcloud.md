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

# Quick Lookup (for AI assistants)

When you see a SonarCloud issue, extract the Rule ID and find the matching lesson:

| Rule ID | Lesson                                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| S3358   | [Extract nested ternary operations](./sonar-lessons/extract-nested-ternary-operations-into-helper-functions.md)                              |
| S2301   | [Provide multiple methods instead of boolean selectors](./sonar-lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md)  |
| S6848   | [Add role and keyboard handling to interactive divs](./sonar-lessons/add-role-and-keyboard-handling-to-interactive-divs.md)                  |
| S6842   | [Do not add interactive ARIA roles to non-interactive elements](./sonar-lessons/use-native-interactive-elements-or-add-proper-aria-roles.md) |
| S6819   | [Use native HTML elements instead of ARIA roles](./sonar-lessons/use-native-html-elements-instead-of-aria-roles.md)                          |
| S6847   | [Use role presentation for non-interactive event handlers](./sonar-lessons/use-role-presentation-for-non-interactive-event-handlers.md)      |

---

# Prevention Checklist

Quick checks before committing. If you're about to write any of these patterns, stop and refactor.

- [ ] **No nested ternaries** — Extract to helper function with early returns
- [ ] **No boolean selector parameters** — Use separate methods or union types
- [ ] **Interactive handlers on interactive elements only** — Use `<button>`, not `<div onClick>`
- [ ] **Prefer native HTML over ARIA roles** — Use `<button>` not `<div role="button">`
- [ ] **Use target check for modal backdrops** — `e.target === e.currentTarget` instead of stopPropagation
- [ ] **No code duplication** — Extract shared logic to functions/components
- [ ] **No overly complex functions** — Keep cyclomatic complexity low

---

# Lessons Learned

Project-specific patterns derived from fixing real issues. Each entry shows what to do in our codebase.

---

## [Extract nested ternary operations into helper functions](./sonar-lessons/extract-nested-ternary-operations-into-helper-functions.md) (S3358)

---

## [Provide multiple methods instead of boolean selector parameters](./sonar-lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md) (S2301)

---

## [Add role and keyboard handling to interactive divs](./sonar-lessons/add-role-and-keyboard-handling-to-interactive-divs.md) (S6848)

---

## [Do not add interactive ARIA roles to non-interactive elements](./sonar-lessons/use-native-interactive-elements-or-add-proper-aria-roles.md) (S6842)

---

## [Use native HTML elements instead of ARIA roles](./sonar-lessons/use-native-html-elements-instead-of-aria-roles.md) (S6819)

---

## [Use role presentation for non-interactive event handlers](./sonar-lessons/use-role-presentation-for-non-interactive-event-handlers.md) (S6847)

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

## [Prefer tag over ARIA role](./sonar-rules/prefer-tag-over-aria-role.md)

---

## [Non-interactive elements shouldn't have event handlers](./sonar-rules/non-interactive-elements-shouldnt-have-event-handlers.md)

---
