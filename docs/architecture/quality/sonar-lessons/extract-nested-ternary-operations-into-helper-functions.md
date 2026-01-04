# Extract Nested Ternary Operations into Helper Functions

**Rule**:
[Ternary operators should not be nested](../sonar-rules/ternary-operators-should-not-be-nested.md)

**Pattern to avoid**:

```tsx
const color = status === 'running' ? 'green' : status === 'completed' ? 'blue' : 'gray';
```

**Fix**: Extract to helper function with early returns:

```tsx
function getStatusColor(status: string): string {
  if (status === 'running') return 'green';
  if (status === 'completed') return 'blue';
  return 'gray';
}

const color = getStatusColor(status);
```

**Exception**: Nested ternaries in JSX are acceptable when
nesting happens in separate `{}` containers.
