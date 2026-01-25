# Prefer 'globalThis' over 'window' (S7764)

## Rule Details

- **Rule ID**: S7764
- **Type**: Code Smell
- **Severity**: Low
- **Tags**: es2020
- **Effort**: 2 min

## Description

`globalThis` is the standardized way to access the global object across all JavaScript environments. Before `globalThis`, developers had to use different global references depending on the environment:

- `window` in browsers
- `global` in Node.js
- `self` in Web Workers

This created compatibility issues when code needed to run in multiple environments. Using environment-specific globals makes code less portable and harder to maintain.

`globalThis` was introduced in ES2020 as a unified solution that works consistently across all JavaScript environments. It provides the same global object reference regardless of whether your code runs in a browser, Node.js, or Web Worker.

Using `globalThis` makes your code more future-proof and eliminates the need for environment detection when accessing global properties.

## Noncompliant Code Example

```typescript
const config = window.APP_CONFIG; // Noncompliant
window.myGlobalVar = 'value'; // Noncompliant
```

## Compliant Solution

```typescript
const config = globalThis.APP_CONFIG;
globalThis.myGlobalVar = 'value';
```

## References

- [SonarSource TypeScript Rule S7764](https://rules.sonarsource.com/typescript/RSPEC-7764/)
- [MDN globalThis](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis)
- [ECMAScript 2020 globalThis specification](https://tc39.es/ecma262/#sec-globalthis)
