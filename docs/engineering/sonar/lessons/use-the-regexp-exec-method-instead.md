---
id: S6594
name: use-the-regexp-exec-method-instead
pattern: "\\.match\\("
extensions: [ts, tsx, js, jsx]
---

# Use the "RegExp.exec()" method instead

## Problem

Sonar flags uses of `String.match()` and recommends using `RegExp.exec()` instead.

```ts
// Non-compliant
const match = currentVersion.match(/v?(\d+)\.?(\d*)/);
```

## Fix

Replace `string.match(regex)` with `regex.exec(string)`:

```ts
// Compliant
const match = /v?(\d+)\.?(\d*)/.exec(currentVersion);
```

## Notes

- This is a mostly mechanical refactor.
- Both APIs return `RegExpExecArray | null` in this usage.

## Files Fixed

- `apps/admin/src/app/(dashboard)/agents/utils.ts`
