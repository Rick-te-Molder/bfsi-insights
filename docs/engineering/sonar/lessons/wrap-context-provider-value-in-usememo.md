# Wrap Context Provider Value in useMemo

## Rule

S6481 - React Context Provider values should have stable identities

## Problem

Creating a new object inline as the Context Provider value causes unnecessary re-renders:

```tsx
function MyProvider({ children }) {
  const [state, setState] = useState(initialState);
  return (
    <MyContext.Provider value={{ state, setState }}>
      {' '}
      {/* New object every render */}
      {children}
    </MyContext.Provider>
  );
}
```

## Why It Matters

1. **Performance**: Every render creates a new object identity
2. **Cascading re-renders**: All consumers re-render even when values haven't changed
3. **React optimization bypass**: React's referential equality checks fail

When the `value` prop changes identity, React will re-render all context consumers, even if the actual data inside hasn't changed.

## Fix

Wrap the value object in `useMemo` with appropriate dependencies:

```tsx
function MyProvider({ children }) {
  const [state, setState] = useState(initialState);
  const value = useMemo(
    () => ({ state, setState }),
    [state], // setState is stable, only include state
  );
  return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
}
```

## When It Applies

- All React Context Providers with object/array values
- Providers with helper functions spread into the value
- Any Provider where value is computed from state or props

## Related

- React useMemo documentation
- React Context performance optimization
