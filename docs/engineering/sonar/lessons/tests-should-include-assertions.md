---
id: S2699
name: Tests should include assertions
pattern: "it\\(['\"].*['\"],\\s*\\(\\)\\s*=>\\s*\\{"
extensions: ['.spec.ts', '.spec.tsx', '.test.ts', '.test.tsx', '.spec.js', '.test.js']
---

# Tests should include assertions

**Sonar Rule**: S2699  
**Sonar Message**: `Add at least one assertion to this test case.`

## The Problem

A test case without assertions provides no value - it will always pass regardless of whether the code under test works correctly. This creates a false sense of security.

## Fix Patterns

### Pattern 1: Add an explicit assertion

If the test is checking that code runs without throwing, add an assertion for the expected return value or side effect.

```ts
// ❌ BAD - no assertion
it('returns early if elements not found', () => {
  const result = setupFunction({ invalid: true });
  // Comment: "Should not throw" is not an assertion
});

// ✅ GOOD - explicit assertion
it('returns early if elements not found', () => {
  const result = setupFunction({ invalid: true });
  expect(result).toBeUndefined();
});
```

### Pattern 2: Use expect.assertions() for async tests

For tests with callbacks or async operations, declare expected assertion count:

```ts
// ✅ GOOD - assertion count declared
it('handles async callback', async () => {
  expect.assertions(1);
  await asyncOperation((result) => {
    expect(result).toBeDefined();
  });
});
```

### Pattern 3: Test for thrown errors explicitly

If testing that code throws, use `expect().toThrow()`:

```ts
// ✅ GOOD - explicit throw assertion
it('throws on invalid input', () => {
  expect(() => processInput(null)).toThrow('Invalid input');
});
```

## Real Example from This Codebase

### `apps/web/tests/features/publications/filters/mobile-sheet.spec.ts`

Test "returns early if sheet elements not found" had no assertions - just a comment "Should not throw".

**Fix**: Added `expect(result).toBeUndefined()` to verify the function returns undefined when sheet elements are missing.

## Files Fixed

- `apps/web/tests/features/publications/filters/mobile-sheet.spec.ts`
