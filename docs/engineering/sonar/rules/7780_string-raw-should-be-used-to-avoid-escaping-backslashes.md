# 'String.raw' should be used to avoid escaping '\' (S7780)

## Rule Details

- **Rule ID**: S7780
- **Type**: Code Smell
- **Severity**: Low
- **Tags**: readability
- **Effort**: 5 min

## Description

String literals with escaped backslashes can be difficult to read and maintain. Each backslash character must be escaped with another backslash, creating sequences like `\\` that are hard to interpret at a glance.

This problem is particularly common when working with:

- File paths on Windows systems
- Regular expression patterns
- LaTeX or other markup that uses backslashes
- Any string content that naturally contains backslash characters

The `String.raw` template literal provides a cleaner alternative. It treats backslashes literally without requiring escaping, making the code more readable and less error-prone. The intent becomes clearer, and there's less chance of accidentally missing or adding extra backslashes during maintenance.

## Noncompliant Code Example

```typescript
const filePath = 'C:\\Users\\Documents\\file.txt'; // Noncompliant
```

## Compliant Solution

```typescript
const filePath = String.raw`C:\Users\Documents\file.txt`;
```

## References

- [SonarSource TypeScript Rule S7780](https://rules.sonarsource.com/typescript/RSPEC-7780/)
- [MDN String.raw](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw)
- [eslint-plugin-unicorn: prefer-string-raw](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-raw.md)
