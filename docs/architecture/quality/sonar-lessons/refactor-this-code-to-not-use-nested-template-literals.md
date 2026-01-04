# Refactor this code to not use nested template literals

**Rule ID**: typescript:S4624  
**SonarCloud message**: "Refactor this code to not use nested template literals."  
**Aliases**: nested template string, nested backtick, conditional template

**Tip**: Extract conditional parts to a variable before the template literal

**Rule**: [Template literals should not be nested](../sonar-rules/4624_template-literals-should-not-be-nested.md)

## Context

Template literals with nested template literals (backticks inside backticks) are hard to read and maintain. This often happens with conditional string building.

## Pattern to avoid

```tsx
// BAD: Nested template literal
const title = `${label}${url ? `: ${url}` : ''}`;

// BAD: Nested template in function call
show('success', `✓ ${step} complete${result.count ? ` (${result.count} items)` : ''}`);
```

## Fix: Extract the conditional part first

```tsx
// GOOD: Extract conditional to variable
const urlSuffix = url ? `: ${url}` : '';
const title = `${label}${urlSuffix}`;

// GOOD: Extract before function call
const countSuffix = result.count ? ` (${result.count} items)` : '';
show('success', `✓ ${step} complete${countSuffix}`);
```

## Benefits

- **Readable**: No nested backticks to parse mentally
- **Debuggable**: Can inspect the intermediate variable
- **Maintainable**: Easy to modify conditional logic

## Real examples

### SourceTable.tsx - tooltip with optional URL

```tsx
// Before (S4624 violation)
title={`${method.label}${method.url ? `: ${method.url}` : ''}`}

// After (fixed)
const urlSuffix = method.url ? `: ${method.url}` : '';
title={`${method.label}${urlSuffix}`}
```

### useEnrichmentActions.ts - success message

```tsx
// Before (S4624 violation)
show(
  'success',
  `✓ ${stepKey} complete${result.processed ? ` (${result.processed} processed)` : ''}`,
);

// After (fixed)
const processedSuffix = result.processed ? ` (${result.processed} processed)` : '';
show('success', `✓ ${stepKey} complete${processedSuffix}`);
```

## When to apply

Use this pattern whenever you have:

- Conditional string suffixes/prefixes in template literals
- Ternary operators inside template literals that produce strings
- Any `${ ... ? \`...\` : '' }` pattern
