# S7781: Strings should use "replaceAll()" instead of "replace()" with global regex

**Rule ID**: typescript:S7781  
**Type**: Code Smell  
**Severity**: Low  
**Tags**: es2021

## Why is this an issue?

When using `String#replace()` with a global regex pattern, developers must:

1. Include the global flag (`g`)
2. Properly escape special regex characters

The `String#replaceAll()` method (ES2021) provides a clearer, safer way to replace all occurrences. It:

- Clearly indicates intent to replace all matches
- Can use a simple string literal when no regex features are needed
- Throws a `TypeError` if a regex without the `g` flag is used, preventing bugs

## Non-compliant code

```typescript
const result = text.replace(/hello/g, 'hi'); // Global regex
const slug = name.replace(/[^a-z0-9]+/g, '-'); // Character class with global
```

## Compliant code

```typescript
const result = text.replaceAll('hello', 'hi'); // String literal
const slug = name.replaceAll(/[^a-z0-9]+/, '-'); // Regex without g flag
```

## See also

- [SonarSource Rule: typescript:S7781](https://rules.sonarsource.com/typescript/RSPEC-7781/)
- [MDN: String.prototype.replaceAll()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll)
- [MDN: String.prototype.replace()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace)
