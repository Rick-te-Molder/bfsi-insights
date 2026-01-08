---
id: S4123
name: Unexpected await of a non-Promise
pattern: "\\bawait\\s+\\w+\\("
extensions: ['.ts', '.tsx', '.js', '.jsx']
---

# Unexpected `await` of a non-Promise (non-"Thenable") value

**Sonar Rule**: S4123  
**Sonar Message**: `Unexpected 'await' of a non-Promise (non-\"Thenable\") value.`

## The Problem

`await` should only be used with:

- a Promise
- a thenable (`{ then: ... }`)

Using `await` on a non-Promise is usually a refactor regression:

- a function stopped being `async` / stopped returning a Promise
- JSDoc or typings incorrectly declare a Promise-returning function as synchronous

## Fix Patterns

### Pattern 1: Remove redundant `await`

If the value is definitely not a Promise, remove the `await`.

```js
// ❌ BAD
const value = await computeSync();

// ✅ GOOD
const value = computeSync();
```

### Pattern 2: Ensure the callee returns a Promise (preferred when the call is truly async)

If the operation is asynchronous, fix the callee so it _actually_ returns a Promise.

For JS files under `checkJs`, ensure JSDoc return types are correct:

```js
/**
 * @returns {Promise<any[]>}
 */
export async function fetchFromSitemap(source, config = {}) {
  return discoverFromSitemap(source, config);
}
```

## Real Example from This Codebase

### `services/agent-api/src/agents/discoverer-fetch.js`

`await fetchFromSitemap(...)` is correct because sitemap discovery is async.
We fixed the JSDoc in `fetchFromSitemap` so static analysis recognizes it as Promise-returning.

## Files Fixed

- `services/agent-api/src/lib/sitemap.js`
