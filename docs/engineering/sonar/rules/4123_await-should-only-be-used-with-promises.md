---
id: S4123
name: await should only be used with promises
pattern: "\\bawait\\s+"
extensions: ['.ts', '.tsx', '.js', '.jsx']
---

# S4123: "await" should only be used with promises

## Rule Details

**Rule ID**: S4123  
**Type**: Code Smell  
**Severity**: Major (typically)  
**Language**: JavaScript / TypeScript

## Description

`await` should only be applied to values that are Promises (or thenables). Awaiting a non-Promise value is usually redundant and often indicates:

- a refactor regression (callee stopped returning a Promise)
- incorrect typing or JSDoc (Promise-returning API is declared as synchronous)

## SonarSource Documentation

- https://rules.sonarsource.com/javascript/RSPEC-4123/

## Related Lesson

See the project lesson:

- `docs/engineering/sonar/lessons/unexpected-await-of-non-promise.md`
