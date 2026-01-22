---
id: S5852
name: using-slow-regular-expressions-is-security-sensitive
---

# S5852: Using slow regular expressions is security-sensitive

## Rule Details

This rule raises a security hotspot when a regular expression may be vulnerable to super-linear runtime due to backtracking (potential ReDoS).

## Why

- Regex backtracking can be exploited with carefully crafted input to cause very slow evaluation
- When applied to user-controlled or unbounded input, this can lead to denial of service

## Links

- [SonarSource Rule](https://rules.sonarsource.com/typescript/RSPEC-5852/)

## Related Lessons

- [avoid-slow-regular-expressions-in-user-controlled-input.md](../lessons/avoid-slow-regular-expressions-in-user-controlled-input.md)
