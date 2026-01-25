# Use String.raw for Escaped Backslashes (S7780)

## Problem

SonarCloud flags string literals that contain escaped backslashes (`\\`). These are difficult to read and maintain because each backslash must be escaped with another backslash.

## Why It Matters

- Double backslashes (`\\`) are hard to read and count
- Easy to accidentally miss or add extra backslashes during maintenance
- `String.raw` makes the intent clearer and reduces errors

## Fix Pattern

Replace escaped backslash strings with `String.raw` template literals:

```typescript
// ❌ Bad - escaped backslashes are hard to read
const filePath = 'C:\\Users\\Documents\\file.txt';
const regex = '/((?!api|_next\\/static|_next\\/image|favicon\\.ico|.*\\.(?:svg|png|jpg)$).*)';

// ✅ Good - String.raw preserves backslashes literally
const filePath = String.raw`C:\Users\Documents\file.txt`;
const regex = String.raw`/((?!api|_next/static|_next/image|favicon\.ico|.*\.(?:svg|png|jpg)$).*)`;
```

## Common Use Cases

### File paths (Windows)

```typescript
// ❌ Bad
const path = 'C:\\Program Files\\App\\config.json';

// ✅ Good
const path = String.raw`C:\Program Files\App\config.json`;
```

### Regular expressions as strings

```typescript
// ❌ Bad
const pattern = '\\d+\\.\\d+';

// ✅ Good
const pattern = String.raw`\d+\.\d+`;
```

### Next.js middleware matchers

```typescript
// ❌ Bad
export const config = {
  matcher: ['/((?!api|_next\\/static|_next\\/image|favicon\\.ico).*)'],
};

// ✅ Good
export const config = {
  matcher: [String.raw`/((?!api|_next/static|_next/image|favicon\.ico).*)`],
};
```

## When NOT to Use String.raw

Don't use `String.raw` when you need actual escape sequences:

```typescript
// These need real escape sequences, not String.raw
const newline = '\n';
const tab = '\t';
const quote = '"';
```

## Prevention

1. **Use `String.raw`** for any string with multiple backslashes
2. **Review regex patterns** stored as strings
3. **Check file paths** especially for Windows compatibility

## References

- [SonarSource Rule S7780](https://rules.sonarsource.com/typescript/RSPEC-7780/)
- [MDN String.raw](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw)
