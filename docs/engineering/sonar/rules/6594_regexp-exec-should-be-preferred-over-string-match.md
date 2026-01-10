---
id: S6594
name: regexp-exec-should-be-preferred-over-string-match
---

# S6594: "RegExp.exec()" should be preferred over "String.match()"

## Rule Details

This rule raises an issue when `String.match()` is used and encourages using `RegExp.exec()` instead.

## Why

- Provides a consistent API for regex matching
- Avoids creating intermediate arrays in some cases
- Aligns with Sonar's preferred pattern

## Links

- [SonarSource Rule](https://rules.sonarsource.com/javascript/RSPEC-6594/)

## Related Lessons

- [use-the-regexp-exec-method-instead.md](../lessons/use-the-regexp-exec-method-instead.md)
