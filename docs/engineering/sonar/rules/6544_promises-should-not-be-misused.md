# S6544: Promises Should Not Be Misused

## Rule Details

**Rule ID**: S6544  
**Type**: Bug  
**Severity**: Major  
**Language**: TypeScript / JavaScript

## Description

This rule detects cases where Promises are passed to contexts expecting void returns, which can lead to:

- Unhandled promise rejections
- Fire-and-forget async operations without error handling
- Type mismatches between expected and actual behavior

## Common Triggers

1. **Async event handlers**: Passing `async` functions to `onClick`, `onSubmit`, etc.
2. **Callback props**: Passing Promise-returning functions to props typed as `() => void`
3. **Array methods**: Using async functions in `.forEach()`, `.map()` without awaiting

## SonarSource Documentation

- [TypeScript Rule S6544](https://rules.sonarsource.com/typescript/RSPEC-6544/)
- [JavaScript Rule S6544](https://rules.sonarsource.com/javascript/RSPEC-6544/)

## Related Lesson

See [promise-returning-function provided to property where a void return was expected](../lessons/promise-returning-function-provided-to-property-where-a-void-return-was-expected.md) for project-specific fix patterns.
