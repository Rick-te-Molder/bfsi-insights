---
id: S6772
name: spacing-between-inline-elements-should-be-explicit
---

# S6772: Spacing between inline elements should be explicit

## Rule Details

This rule raises an issue when there is ambiguous whitespace between inline JSX elements. React JSX differs from HTML in how it handles newline characters and surrounding whitespace - JSX removes such sequences completely, leaving no space between inline elements.

## Why

- **Unexpected behavior**: Missing whitespace between elements like checkboxes and labels
- **Confusing code**: The visual appearance in source code doesn't match the rendered output
- **Maintainability**: Makes spacing intentions clear to other developers

## How to Fix

Either insert an explicit JSX space as a string expression `{' '}`, or insert an empty comment expression `{/**/}` to indicate that the two parts will be joined together with no space between them.

## Links

- [SonarSource Rule](https://rules.sonarsource.com/typescript/RSPEC-6772)

## Related Lessons

- [ambiguous-spacing-after-previous-element.md](../lessons/ambiguous-spacing-after-previous-element.md)
