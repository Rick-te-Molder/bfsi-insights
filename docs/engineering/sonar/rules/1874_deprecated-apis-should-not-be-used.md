# S1874: Deprecated APIs should not be used

**Severity**: Major  
**Type**: Code Smell  
**Category**: Maintainability

---

## Official Documentation

- **TypeScript**: https://rules.sonarsource.com/typescript/RSPEC-1874
- **JavaScript**: https://rules.sonarsource.com/javascript/RSPEC-1874

---

## Description

Deprecated code should not be used because:

1. It may be removed in future versions
2. There are better alternatives available
3. It indicates outdated practices
4. It can cause compatibility issues

Common deprecated APIs in JavaScript/TypeScript:

- Direct `document` and `window` references (use `globalThis`)
- `String.prototype.substr()` (use `substring()` or `slice()`)
- `Date.prototype.getYear()` (use `getFullYear()`)
- Various deprecated DOM methods

---

## Why is this an issue?

Using deprecated APIs:

- Creates technical debt
- May break when dependencies are updated
- Signals to other developers that the code is outdated
- Can have performance or security implications

---

## How to fix

1. Identify the deprecated API from the Sonar message
2. Check the official documentation for the recommended replacement
3. Replace all occurrences with the modern alternative
4. Test to ensure behavior is preserved

---

## See also

- [Use globalThis instead of deprecated global APIs](../lessons/use-globalthis-instead-of-deprecated-global-apis.md)
- [Prefer globalThis over window](../lessons/prefer-globalthis-over-window.md)
