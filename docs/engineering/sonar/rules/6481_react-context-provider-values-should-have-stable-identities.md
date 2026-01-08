# S6481: React Context Provider values should have stable identities

## Rule Details

- **Rule ID**: S6481
- **Type**: Code Smell
- **Severity**: Medium
- **Category**: Maintainability, Performance

## Description

Whenever the `value` property of React context changes, React will rerender the context and all its child nodes and consumers. In JavaScript, things like object literals or function expressions will create a new identity every time they are evaluated. Such constructions should not be directly used as context `value` because React will always consider they have changed.

## Why

- **Performance**: Prevents unnecessary re-renders of context consumers
- **React optimization**: Allows React's referential equality checks to work correctly
- **Predictable behavior**: Context updates only when actual data changes

## Non-compliant

```tsx
function Component() {
  return (
    <SomeContext.Provider value={{ foo: 'bar' }}>
      <SomeComponent />
    </SomeContext.Provider>
  );
}
```

## Compliant

```tsx
function Component() {
  const obj = useMemo(() => ({ foo: 'bar' }), []);
  return (
    <SomeContext.Provider value={obj}>
      <SomeComponent />
    </SomeContext.Provider>
  );
}
```

## Links

- [SonarSource Rule](https://rules.sonarsource.com/typescript/RSPEC-6481)
- [React Context Documentation](https://react.dev/reference/react/useContext)

## Related Lessons

- [wrap-context-provider-value-in-usememo.md](../lessons/wrap-context-provider-value-in-usememo.md)
