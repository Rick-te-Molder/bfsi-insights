# SonarCloud Code Quality Rules

This document captures patterns that SonarCloud flags and how to fix them. These rules help maintain readable, maintainable code.

---

## Nested Ternary Operations

**Problem**: Nested ternaries are hard to read and make the order of operations complex to understand. They force readers to mentally track multiple conditional branches inline.

**Bad**:

```tsx
const color = status === 'running' ? 'green' : status === 'completed' ? 'blue' : 'gray';
```

**Good**: Extract the logic into a helper function with early returns:

```tsx
function getStatusColor(status: string): string {
  if (status === 'running') return 'green';
  if (status === 'completed') return 'blue';
  return 'gray';
}

const color = getStatusColor(status);
```

**Exception**: Nested ternaries in JSX are acceptable when the nesting happens in separate JSX expression containers (separate `{}`), as each expression is visually isolated.

---

## More rules will be added as SonarCloud flags them.
