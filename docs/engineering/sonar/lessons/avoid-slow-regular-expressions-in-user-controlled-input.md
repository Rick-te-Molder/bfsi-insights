---
id: S5852
name: avoid-slow-regular-expressions-in-user-controlled-input
pattern: "replace\\(\\/\\[\\?\\#\\]"
extensions: [ts, tsx, js, jsx]
advisory: true
---

# Avoid slow regular expressions in user-controlled input

## Problem

Sonar flags regular expressions that can be vulnerable to super-linear runtime due to backtracking, which can lead to denial of service when applied to user-controlled or unbounded input.

A common pattern is trimming a URL by removing query strings and fragments using a regex.

## Fix

Prefer non-regex string operations when the transformation is simple. For example, to remove a query string and fragment:

- Normalize the string once (e.g., `toLowerCase()`)
- Find the first occurrence of `?` or `#`
- Slice the string to that index

This avoids ReDoS risks entirely because it is linear-time.

## Notes

- Use regex only when you need pattern matching, and keep patterns linear-time (avoid nested quantifiers / ambiguous alternations).
- This lesson is advisory because not all regex usage is exploitable, but the safest default is to avoid regex for simple parsing.

## Files Fixed

- `apps/admin/src/app/api/_lib/reenrich-queue.ts`
