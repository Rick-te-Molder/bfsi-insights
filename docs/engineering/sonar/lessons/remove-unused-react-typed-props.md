# Remove Unused React Typed Props (S6767)

## Problem

SonarCloud flags React component props that are defined in the type but appear unused in the component body. This can happen when:

1. Props are genuinely unused and should be removed
2. Props are passed through as an object (e.g., `helperFn(props)`) without explicit destructuring

## Why It Matters

- Unused props increase bundle size and memory footprint
- They confuse other developers about the component's API
- They may indicate incomplete implementation or copy-paste errors

## Fix Pattern

### Case 1: Props are genuinely unused

Remove the unused prop from the type definition:

```tsx
// ❌ Bad - isAdmin is never used
function UserCard(props: { name: string; isAdmin: boolean }) {
  return <div>{props.name}</div>;
}

// ✅ Good - remove unused prop
function UserCard(props: { name: string }) {
  return <div>{props.name}</div>;
}
```

### Case 2: Props are passed through to helpers (false positive)

Destructure props explicitly to make usage clear:

```tsx
// ❌ Bad - SonarCloud can't see that isUtilityAgent is used
function RowMetaCells(props: {
  readonly currentPrompt: PromptVersion | undefined;
  readonly isUtilityAgent: boolean;
}) {
  return <td>{getDisplayVersion(props)}</td>;
}

// ✅ Good - explicit destructuring shows usage
function RowMetaCells(props: {
  readonly currentPrompt: PromptVersion | undefined;
  readonly isUtilityAgent: boolean;
}) {
  const { currentPrompt, isUtilityAgent } = props;
  return <td>{getDisplayVersion({ currentPrompt, isUtilityAgent })}</td>;
}
```

## Prevention

1. **Destructure props** at the start of the component to make usage explicit
2. **Remove props** that are no longer needed after refactoring
3. **Use TypeScript strict mode** to catch unused variables at compile time

## References

- [SonarSource Rule S6767](https://rules.sonarsource.com/typescript/RSPEC-6767/)
