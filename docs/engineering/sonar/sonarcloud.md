# SonarCloud Quality Standards

---

**Version**: 1.18.0  
**Last updated**: 2026-01-22  
**Quality System Control**: C7 (Static analysis)  
**Change history**:

- 1.18.0 (2026-01-22): Added S3776 (reduce cognitive complexity).
- 1.17.0 (2026-01-22): Added S5852 (avoid slow regex / ReDoS hotspots).
- 1.16.0 (2026-01-11): Added S6594 (prefer RegExp.exec() over String.match()).
- 1.15.0 (2026-01-08): Improved S6759 pattern to catch inline props (}: {) missing Readonly wrapper.
- 1.14.0 (2026-01-08): Added S7763 (use export...from syntax for re-exports).
- 1.13.0 (2026-01-08): Added S6644 (use logical OR instead of ternary for default values).
- 1.12.0 (2026-01-08): Fix S4662 docs to use sonar.issue.ignore.multicriteria for Tailwind v4 at-rules in globals.css.
- 1.11.0 (2026-01-08): Added S6481 (wrap Context Provider value in useMemo).
- 1.10.0 (2026-01-08): Added S4662 (configure Tailwind CSS at-rules in sonar-project.properties).
- 1.9.0 (2026-01-08): Added S7772 (prefer node: protocol for Node.js built-in imports).
- 1.8.0 (2026-01-08): Added S6772 (spacing between inline elements should be explicit).
- 1.7.0 (2026-01-08): Added S7773 (prefer Number.parseInt over parseInt).
- 1.6.0 (2026-01-08): Added S4123 (await should only be used with promises).
- 1.5.0 (2026-01-08): Added S6544 (promises should not be misused).
- 1.4.0 (2026-01-05): Added S7735 (avoid negated conditions with else clause).
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

| Rule ID | Lesson                                                                                                                                                                            | File                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| S3358   | [Extract nested ternary operations](./lessons/extract-nested-ternary-operations-into-helper-functions.md)                                                                         | `lessons/extract-nested-ternary-operations-into-helper-functions.md`                          |
| S3358   | [Extract this nested ternary operation into an independent statement](./lessons/extract-this-nested-ternary-operation-into-an-independent-statement.md)                           | `lessons/extract-this-nested-ternary-operation-into-an-independent-statement.md`              |
| S2301   | [Provide multiple methods instead of boolean selectors](./lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md)                                             | `lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md`                  |
| S6848   | [Add role and keyboard handling to interactive divs](./lessons/add-role-and-keyboard-handling-to-interactive-divs.md)                                                             | `lessons/add-role-and-keyboard-handling-to-interactive-divs.md`                               |
| S6842   | [Do not add interactive ARIA roles to non-interactive elements](./lessons/use-native-interactive-elements-or-add-proper-aria-roles.md)                                            | `lessons/use-native-interactive-elements-or-add-proper-aria-roles.md`                         |
| S6819   | [Use native HTML elements instead of ARIA roles](./lessons/use-native-html-elements-instead-of-aria-roles.md)                                                                     | `lessons/use-native-html-elements-instead-of-aria-roles.md`                                   |
| S6847   | [Use role presentation for non-interactive event handlers](./lessons/use-role-presentation-for-non-interactive-event-handlers.md)                                                 | `lessons/use-role-presentation-for-non-interactive-event-handlers.md`                         |
| S4624   | [Refactor this code to not use nested template literals](./lessons/refactor-this-code-to-not-use-nested-template-literals.md)                                                     | `lessons/refactor-this-code-to-not-use-nested-template-literals.md`                           |
| S6479   | [Do not use Array index in keys](./lessons/do-not-use-array-index-in-keys.md)                                                                                                     | `lessons/do-not-use-array-index-in-keys.md`                                                   |
| S6759   | [Mark React props as read-only](./lessons/mark-react-props-as-read-only.md)                                                                                                       | `lessons/mark-react-props-as-read-only.md`                                                    |
| S6551   | [Will use Object's default stringification format](./lessons/will-use-objects-default-stringification-format.md)                                                                  | `lessons/will-use-objects-default-stringification-format.md`                                  |
| S7781   | [Prefer 'String#replaceAll()' over 'String#replace()'](./lessons/prefer-string-replaceall-over-string-replace.md)                                                                 | `lessons/prefer-string-replaceall-over-string-replace.md`                                     |
| S7735   | [Unexpected negated condition](./lessons/unexpected-negated-condition.md)                                                                                                         | `lessons/unexpected-negated-condition.md`                                                     |
| S6544   | [Promise-returning function provided to property where a void return was expected](./lessons/promise-returning-function-provided-to-property-where-a-void-return-was-expected.md) | `lessons/promise-returning-function-provided-to-property-where-a-void-return-was-expected.md` |
| S4123   | [Unexpected `await` of a non-Promise (non-"Thenable") value](./lessons/unexpected-await-of-non-promise.md)                                                                        | `lessons/unexpected-await-of-non-promise.md`                                                  |
| S7773   | [Prefer `Number.parseInt` over `parseInt`](./lessons/prefer-number-parseint-over-parseint.md)                                                                                     | `lessons/prefer-number-parseint-over-parseint.md`                                             |
| S6772   | [Ambiguous spacing after previous element](./lessons/ambiguous-spacing-after-previous-element.md)                                                                                 | `lessons/ambiguous-spacing-after-previous-element.md`                                         |
| S7772   | [Prefer node: protocol for Node.js built-in imports](./lessons/prefer-node-protocol-for-builtins.md)                                                                              | `lessons/prefer-node-protocol-for-builtins.md`                                                |
| S4662   | [Configure Tailwind CSS at-rules for SonarCloud](./lessons/configure-tailwind-css-at-rules.md)                                                                                    | `lessons/configure-tailwind-css-at-rules.md`                                                  |
| S6481   | [Wrap Context Provider value in useMemo](./lessons/wrap-context-provider-value-in-usememo.md)                                                                                     | `lessons/wrap-context-provider-value-in-usememo.md`                                           |
| S6644   | [Use logical OR instead of ternary for default values](./lessons/use-logical-or-instead-of-ternary-for-default-values.md)                                                         | `lessons/use-logical-or-instead-of-ternary-for-default-values.md`                             |
| S7763   | [Use export...from for re-exports](./lessons/use-export-from-for-re-exports.md)                                                                                                   | `lessons/use-export-from-for-re-exports.md`                                                   |
| S6594   | [Use the "RegExp.exec()" method instead](./lessons/use-the-regexp-exec-method-instead.md)                                                                                         | `lessons/use-the-regexp-exec-method-instead.md`                                               |
| S3776   | [Reduce cognitive complexity by extracting helpers](./lessons/reduce-cognitive-complexity-by-extracting-helpers.md)                                                               | `lessons/reduce-cognitive-complexity-by-extracting-helpers.md`                                |
| S5852   | [Avoid slow regular expressions in user-controlled input](./lessons/avoid-slow-regular-expressions-in-user-controlled-input.md)                                                   | `lessons/avoid-slow-regular-expressions-in-user-controlled-input.md`                          |

---

# ESLint Rules Matching Sonar Patterns

The following ESLint rules are enabled to catch common Sonar issues at lint time (faster than full Sonar analysis):

| Sonar Rule | ESLint Rule                                  | Package                       | Severity |
| ---------- | -------------------------------------------- | ----------------------------- | -------- |
| S3358      | `no-nested-ternary`                          | built-in                      | warn     |
| S7735      | `no-negated-condition`                       | built-in                      | warn     |
| S7781      | `unicorn/prefer-string-replace-all`          | eslint-plugin-unicorn         | warn     |
| S6479      | `react/no-array-index-key`                   | eslint-plugin-react           | warn     |
| S1116      | `no-empty`                                   | built-in                      | warn     |
| S1186      | `no-empty-function`                          | built-in                      | warn     |
| S1481      | `no-unused-vars`                             | built-in                      | warn     |
| S1854      | `no-unused-expressions`                      | built-in                      | warn     |
| S3776      | `max-depth`                                  | built-in                      | warn (4) |
| S1117      | `no-shadow` / `@typescript-eslint/no-shadow` | built-in / @typescript-eslint | warn     |
| S4144      | `no-dupe-else-if`                            | built-in                      | error    |
| S1871      | `no-duplicate-case`                          | built-in                      | error    |

**Configuration files**:

- Root: `eslint.config.js`
- Admin app: `apps/admin/eslint.config.mjs`

---

# Pre-Commit Pattern Check

A lightweight pre-commit check (`scripts/ci/check-sonar-patterns.cjs`) warns when staged files contain patterns we've documented as Sonar lessons/rules. This catches regressions before CI.

**Checked patterns**: S2301, S3358, S4123, S4624, S6479, S6544, S6551, S6594, S6759, S6772, S6819, S6842, S6847, S6848, S7735, S7772, S7773, S7781

**Behavior**: Blocks on patterns marked `blocking: true` in lessons; warns otherwise (use `--strict` to block warnings)

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
- [ ] **Avoid negated conditions with else** — Use positive conditions: `if (valid)` not `if (!invalid)`
- [ ] **Don't return Promises where void expected** — Use block body `() => { asyncFn(); }` not `() => asyncFn()`
- [ ] **Don't `await` non-Promises** — Ensure the value is a Promise/thenable, or remove the redundant `await`
- [ ] **Use Number.parseInt() over parseInt()** — Prefer `Number.parseInt()` and `Number.parseFloat()` over global equivalents
- [ ] **Use explicit JSX spacing** — Add `{' '}` between inline elements and text on separate lines
- [ ] **Use node: protocol for built-ins** — Import Node.js modules with `node:fs`, `node:path`, etc.
- [ ] **Configure Tailwind CSS at-rules** — Ignore `css:S4662` for `apps/admin/src/app/globals.css` via `sonar.issue.ignore.multicriteria` in sonar-project.properties
- [ ] **Wrap Context Provider values in useMemo** — Memoize object values passed to React Context Providers
- [ ] **Use || or ?? instead of ternary for defaults** — Replace `x ? x : y` with `x || y`
- [ ] **Use export...from for re-exports** — Replace `import { x } from './mod'; export { x };` with `export { x } from './mod';`
- [ ] **Prefer RegExp.exec over String.match** — Use `/re/.exec(str)` instead of `str.match(/re/)`
- [ ] **Avoid slow regex for simple parsing** — Prefer `indexOf` + `slice` for URL/query/fragment trimming (avoid ReDoS hotspots)
- [ ] **Reduce cognitive complexity** — Extract validation/side-effect blocks into helpers and prefer guard clauses

---

# Lessons Learned

Project-specific patterns derived from fixing real issues. Each entry shows what to do in our codebase.

---

## [Extract nested ternary operations into helper functions](./lessons/extract-nested-ternary-operations-into-helper-functions.md) (S3358)

---

## [Extract this nested ternary operation into an independent statement](./lessons/extract-this-nested-ternary-operation-into-an-independent-statement.md) (S3358)

---

## [Provide multiple methods instead of boolean selector parameters](./lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md) (S2301)

---

## [Add role and keyboard handling to interactive divs](./lessons/add-role-and-keyboard-handling-to-interactive-divs.md) (S6848)

---

## [Do not add interactive ARIA roles to non-interactive elements](./lessons/use-native-interactive-elements-or-add-proper-aria-roles.md) (S6842)

---

## [Use native HTML elements instead of ARIA roles](./lessons/use-native-html-elements-instead-of-aria-roles.md) (S6819)

---

## [Use role presentation for non-interactive event handlers](./lessons/use-role-presentation-for-non-interactive-event-handlers.md) (S6847)

---

## [Refactor this code to not use nested template literals](./lessons/refactor-this-code-to-not-use-nested-template-literals.md) (S4624)

---

## [Do not use Array index in keys](./lessons/do-not-use-array-index-in-keys.md) (S6479)

---

## [Mark React props as read-only](./lessons/mark-react-props-as-read-only.md) (S6759)

---

## [Will use Object's default stringification format](./lessons/will-use-objects-default-stringification-format.md) (S6551)

---

## [Prefer 'String#replaceAll()' over 'String#replace()'](./lessons/prefer-string-replaceall-over-string-replace.md) (S7781)

---

## [Unexpected negated condition](./lessons/unexpected-negated-condition.md) (S7735)

---

## [Promise-returning function provided to property where a void return was expected](./lessons/promise-returning-function-provided-to-property-where-a-void-return-was-expected.md) (S6544)

---

## [Unexpected `await` of a non-Promise (non-"Thenable") value](./lessons/unexpected-await-of-non-promise.md) (S4123)

---

## [Prefer `Number.parseInt` over `parseInt`](./lessons/prefer-number-parseint-over-parseint.md) (S7773)

---

## [Ambiguous spacing after previous element](./lessons/ambiguous-spacing-after-previous-element.md) (S6772)

---

## [Prefer node: protocol for Node.js built-in imports](./lessons/prefer-node-protocol-for-builtins.md) (S7772)

---

## [Configure Tailwind CSS at-rules for SonarCloud](./lessons/configure-tailwind-css-at-rules.md) (S4662)

---

## [Wrap Context Provider value in useMemo](./lessons/wrap-context-provider-value-in-usememo.md) (S6481)

---

## [Use logical OR instead of ternary for default values](./lessons/use-logical-or-instead-of-ternary-for-default-values.md) (S6644)

---

## [Use export...from for re-exports](./lessons/use-export-from-for-re-exports.md) (S7763)

---

## [Use the "RegExp.exec()" method instead](./lessons/use-the-regexp-exec-method-instead.md) (S6594)

---

## [Avoid slow regular expressions in user-controlled input](./lessons/avoid-slow-regular-expressions-in-user-controlled-input.md) (S5852)

---

## [Reduce cognitive complexity by extracting helpers](./lessons/reduce-cognitive-complexity-by-extracting-helpers.md) (S3776)

---

# Rule Index

Rules we've encountered. Links to authoritative SonarSource documentation.

## [Ternary operators should not be nested](./rules/3358_ternary-operators-should-not-be-nested.md)

---

## [Methods should not contain selector parameters](./rules/2301_methods-should-not-contain-selector-parameters.md)

---

## [Non-interactive elements should not have interactive handlers](./rules/6848_non-interactive-elements-should-not-have-interactive-handlers.md)

---

## [Non-interactive DOM elements should not have interactive ARIA roles](./rules/6842_non-interactive-dom-elements-should-not-have-interactive-aria-roles.md)

---

## [Prefer tag over ARIA role](./rules/6819_prefer-tag-over-aria-role.md)

---

## [Non-interactive elements shouldn't have event handlers](./rules/6847_non-interactive-elements-shouldnt-have-event-handlers.md)

---

## [Template literals should not be nested](./rules/4624_template-literals-should-not-be-nested.md)

---

## [JSX list components should not use array indexes as key](./rules/6479_jsx-list-components-should-not-use-array-indexes-as-key.md)

---

## [React props should be read-only](./rules/6759_react-props-should-be-read-only.md)

---

## [Objects converted to strings should define a toString method](./rules/6551_objects-converted-to-strings-should-define-tostring-method.md)

---

## [Strings should use replaceAll instead of replace with global regex](./rules/7781_strings-should-use-replaceall-instead-of-replace-with-global-regex.md)

---

## [Negated conditions should be avoided when else clause is present](./rules/7735_negated-conditions-should-be-avoided-when-else-clause-is-present.md)

---

## [Promises should not be misused](./rules/6544_promises-should-not-be-misused.md)

---

## ["await" should only be used with promises](./rules/4123_await-should-only-be-used-with-promises.md)

---

## [Number static methods should be preferred over global equivalents](./rules/7773_number-static-methods-preferred.md)

---

## [Spacing between inline elements should be explicit](./rules/6772_spacing-between-inline-elements-should-be-explicit.md)

---

## [Node.js built-in modules should use node: protocol](./rules/7772_prefer-node-protocol-for-builtins.md)

---

## ["@at-rules" should be valid](./rules/4662_at-rules-should-be-valid.md)

---

## [React Context Provider values should have stable identities](./rules/6481_react-context-provider-values-should-have-stable-identities.md)

---

## [Ternary operator should not be used instead of simpler alternatives](./rules/6644_ternary-operator-should-not-be-used-instead-of-simpler-alternatives.md)

---

## [Re-exports should use export...from syntax](./rules/7763_re-exports-should-use-export-from-syntax.md)

---

## ["RegExp.exec()" should be preferred over "String.match()"](./rules/6594_regexp-exec-should-be-preferred-over-string-match.md)

---

## [Using slow regular expressions is security-sensitive](./rules/5852_using-slow-regular-expressions-is-security-sensitive.md)

---

## [Cognitive Complexity of functions should not be too high](./rules/3776_cognitive-complexity-of-functions-should-not-be-too-high.md)

---
