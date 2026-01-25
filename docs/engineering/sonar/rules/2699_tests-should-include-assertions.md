---
id: S2699
name: Tests should include assertions
pattern: "it\\(['\"]"
extensions: ['.spec.ts', '.spec.tsx', '.test.ts', '.test.tsx', '.spec.js', '.test.js']
---

# S2699: Tests should include assertions

## Rule Details

**Rule ID**: S2699  
**Type**: Code Smell  
**Severity**: Blocker  
**Language**: JavaScript / TypeScript

## Description

A test case without any assertion is not verifying anything. It will always pass, regardless of whether the code under test works correctly. This creates a false sense of security and defeats the purpose of having tests.

The rule raises an issue when one of the following assertion libraries is imported but no assertion is used in a test:

- chai
- sinon
- vitest
- supertest

## SonarSource Documentation

- https://rules.sonarsource.com/typescript/RSPEC-2699/

## Related Lesson

See the project lesson:

- `docs/engineering/sonar/lessons/tests-should-include-assertions.md`
