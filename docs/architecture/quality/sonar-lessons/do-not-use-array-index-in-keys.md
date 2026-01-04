# Do not use Array index in keys

**Rule ID**: typescript:S6479  
**SonarCloud message**: "Do not use Array index in keys"  
**Aliases**: array index key, map index key, React key prop

**Tip**: Use a unique identifier from the data (id, slug, code, name) as the key

**Rule**: [JSX list components should not use array indexes as key](../sonar-rules/6479_jsx-list-components-should-not-use-array-indexes-as-key.md)

## Context

React uses the `key` prop to identify which items have changed, been added, or removed. Using array indexes as keys can cause issues when items are reordered, inserted, or deleted - React may reuse the wrong DOM elements, leading to bugs and performance issues.

## Pattern to avoid

```tsx
// BAD: Using array index as key
{
  items.map((item, i) => <div key={i}>{item.name}</div>);
}

// BAD: Using index in compound key
{
  items.map((item, i) => <span key={`item-${i}`}>{item.code}</span>);
}
```

## Fix: Use unique identifiers from the data

```tsx
// GOOD: Use unique id from database
{
  items.map((item) => <div key={item.id}>{item.name}</div>);
}

// GOOD: Use unique code/slug
{
  items.map((item) => <span key={item.code}>{item.code}</span>);
}

// GOOD: Use name if guaranteed unique in context
{
  names.map((name) => <span key={name}>{name}</span>);
}

// GOOD: Combine parent context with item identifier
{
  codes.map((code) => <span key={`${config.slug}-${code}`}>{code}</span>);
}
```

## What to use as key

Priority order:

1. **Database ID** (`item.id`, `item.uuid`) - always unique
2. **Slug/code** (`item.slug`, `item.code`) - usually unique within context
3. **Composite key** (`${parent}-${child.code}`) - when item is unique within parent
4. **Name/label** - only if guaranteed unique in the list

## Benefits

- **Correct reconciliation**: React correctly identifies which items changed
- **No state bugs**: Component state stays with the right item
- **Better performance**: React can reuse DOM elements correctly

## Real examples

### TagDisplay.tsx - use name as key

```tsx
// Before (S6479 violation)
values.map((name, i) => <span key={i}>{name}</span>);

// After (fixed)
values.map((name) => <span key={name}>{name}</span>);
```

### evaluation-panel.tsx - use compound key

```tsx
// Before (S6479 violation)
enrichmentLog.map((entry, idx) => <div key={idx}>...</div>);

// After (fixed)
enrichmentLog.map((entry) => <div key={`${entry.agent}-${entry.timestamp}`}>...</div>);
```

### results.tsx - use itemId

```tsx
// Before (S6479 violation)
results.map((result, idx) => <ResultCard key={idx} result={result} />);

// After (fixed)
results.map((result) => <ResultCard key={result.itemId} result={result} />);
```

## When to apply

Use this pattern whenever you have:

- `.map()` rendering JSX elements
- `key={i}` or `key={idx}` or `key={index}`
- Any key that uses the second parameter of the map callback
