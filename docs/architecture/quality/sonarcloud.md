# SonarCloud Quality Standards

---

**Version**: 1.3.0  
**Last updated**: 2026-01-05  
**Quality System Control**: C7 (Static analysis)  
**Change history**:

- 1.3.0 (2026-01-05): Added S7781 (prefer replaceAll over replace with global regex).
- 1.2.0 (2026-01-05): Added S6551 (use type guards before string coercion).
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

| Rule ID | Lesson                                                                                                                                                        | File                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| S3358   | [Extract nested ternary operations](./sonar-lessons/extract-nested-ternary-operations-into-helper-functions.md)                                               | `sonar-lessons/extract-nested-ternary-operations-into-helper-functions.md`             |
| S3358   | [Extract this nested ternary operation into an independent statement](./sonar-lessons/extract-this-nested-ternary-operation-into-an-independent-statement.md) | `sonar-lessons/extract-this-nested-ternary-operation-into-an-independent-statement.md` |
| S2301   | [Provide multiple methods instead of boolean selectors](./sonar-lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md)                   | `sonar-lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md`     |
| S6848   | [Add role and keyboard handling to interactive divs](./sonar-lessons/add-role-and-keyboard-handling-to-interactive-divs.md)                                   | `sonar-lessons/add-role-and-keyboard-handling-to-interactive-divs.md`                  |
| S6842   | [Do not add interactive ARIA roles to non-interactive elements](./sonar-lessons/use-native-interactive-elements-or-add-proper-aria-roles.md)                  | `sonar-lessons/use-native-interactive-elements-or-add-proper-aria-roles.md`            |
| S6819   | [Use native HTML elements instead of ARIA roles](./sonar-lessons/use-native-html-elements-instead-of-aria-roles.md)                                           | `sonar-lessons/use-native-html-elements-instead-of-aria-roles.md`                      |
| S6847   | [Use role presentation for non-interactive event handlers](./sonar-lessons/use-role-presentation-for-non-interactive-event-handlers.md)                       | `sonar-lessons/use-role-presentation-for-non-interactive-event-handlers.md`            |
| S4624   | [Refactor this code to not use nested template literals](./sonar-lessons/refactor-this-code-to-not-use-nested-template-literals.md)                           | `sonar-lessons/refactor-this-code-to-not-use-nested-template-literals.md`              |
| S6479   | [Do not use Array index in keys](./sonar-lessons/do-not-use-array-index-in-keys.md)                                                                           | `sonar-lessons/do-not-use-array-index-in-keys.md`                                      |
| S6759   | [Mark React props as read-only](./sonar-lessons/mark-react-props-as-read-only.md)                                                                             | `sonar-lessons/mark-react-props-as-read-only.md`                                       |
| S6551   | [Will use Object's default stringification format](./sonar-lessons/will-use-objects-default-stringification-format.md)                                        | `sonar-lessons/will-use-objects-default-stringification-format.md`                     |
| S7781   | [Prefer 'String#replaceAll()' over 'String#replace()'](./sonar-lessons/prefer-string-replaceall-over-string-replace.md)                                       | `sonar-lessons/prefer-string-replaceall-over-string-replace.md`                        |

---

# Prevention Checklist

Quick checks before committing. If you're about to write any of these patterns, stop and refactor.

- [ ] **No nested ternaries** — Extract to helper function with early returns
- [ ] **No nested template literals** — Extract conditional parts to variables first
- [ ] **No array index as React key** — Use unique identifier from data (id, slug, code)
- [ ] **Mark React props as read-only** — Use `Readonly<Props>` wrapper on component props
- [ ] **No boolean selector parameters** — Use separate methods or union types
- [ ] **Interactive handlers on interactive elements only** — Use `<button>`, not `<div onClick>`
- [ ] **Prefer native HTML over ARIA roles** — Use `<button>` not `<div role="button">`
- [ ] **Use target check for modal backdrops** — `e.target === e.currentTarget` instead of stopPropagation
- [ ] **No code duplication** — Extract shared logic to functions/components
- [ ] **No overly complex functions** — Keep cyclomatic complexity low
- [ ] **Use type guards before string coercion** — Check `typeof val === 'string'` before using `unknown` in template literals
- [ ] **Use replaceAll() for global replacement** — Prefer `.replaceAll()` over `.replace(/pattern/g, ...)`

---

# Lessons Learned

Project-specific patterns derived from fixing real issues. Each entry shows what to do in our codebase.

---

## [Extract nested ternary operations into helper functions](./sonar-lessons/extract-nested-ternary-operations-into-helper-functions.md) (S3358)

---

## [Extract this nested ternary operation into an independent statement](./sonar-lessons/extract-this-nested-ternary-operation-into-an-independent-statement.md) (S3358)

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

## [Refactor this code to not use nested template literals](./sonar-lessons/refactor-this-code-to-not-use-nested-template-literals.md) (S4624)

---

## [Do not use Array index in keys](./sonar-lessons/do-not-use-array-index-in-keys.md) (S6479)

---

## [Mark React props as read-only](./sonar-lessons/mark-react-props-as-read-only.md) (S6759)

---

## [Will use Object's default stringification format](./sonar-lessons/will-use-objects-default-stringification-format.md) (S6551)

---

## [Prefer 'String#replaceAll()' over 'String#replace()'](./sonar-lessons/prefer-string-replaceall-over-string-replace.md) (S7781)

---

# Rule Index

Rules we've encountered. Links to authoritative SonarSource documentation.

## [Ternary operators should not be nested](./sonar-rules/3358_ternary-operators-should-not-be-nested.md)

---

## [Methods should not contain selector parameters](./sonar-rules/2301_methods-should-not-contain-selector-parameters.md)

---

## [Non-interactive elements should not have interactive handlers](./sonar-rules/6848_non-interactive-elements-should-not-have-interactive-handlers.md)

---

## [Non-interactive DOM elements should not have interactive ARIA roles](./sonar-rules/6842_non-interactive-dom-elements-should-not-have-interactive-aria-roles.md)

---

## [Prefer tag over ARIA role](./sonar-rules/6819_prefer-tag-over-aria-role.md)

---

## [Non-interactive elements shouldn't have event handlers](./sonar-rules/6847_non-interactive-elements-shouldnt-have-event-handlers.md)

---

## [Template literals should not be nested](./sonar-rules/4624_template-literals-should-not-be-nested.md)

---

## [JSX list components should not use array indexes as key](./sonar-rules/6479_jsx-list-components-should-not-use-array-indexes-as-key.md)

---

## [React props should be read-only](./sonar-rules/6759_react-props-should-be-read-only.md)

---

## [Objects converted to strings should define a toString method](./sonar-rules/6551_objects-converted-to-strings-should-define-tostring-method.md)

---

## [Strings should use replaceAll instead of replace with global regex](./sonar-rules/7781_strings-should-use-replaceall-instead-of-replace-with-global-regex.md)

---
