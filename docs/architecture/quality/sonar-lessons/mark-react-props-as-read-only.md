# Lesson: Mark React Props as Read-Only

**Rule:** [S6759 - React props should be read-only](../sonar-rules/6759_react-props-should-be-read-only.md)

## The Problem

React functional components receive props from parent components. If these props are mutable, child components could accidentally or intentionally modify them, leading to:

- **Unpredictable behavior** - parent state could change unexpectedly
- **Hard-to-track bugs** - mutations can happen anywhere in the component tree
- **Performance issues** - React's rendering optimizations rely on immutability

## Pattern to Avoid

```tsx
// ❌ BAD: Props interface is not read-only
interface ButtonProps {
  label: string;
  onClick: () => void;
}

function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}
```

## Fix Pattern

Use TypeScript's `Readonly<>` utility type to wrap the entire props interface:

```tsx
// ✅ GOOD: Props are wrapped with Readonly<>
interface ButtonProps {
  label: string;
  onClick: () => void;
}

function Button({ label, onClick }: Readonly<ButtonProps>) {
  return <button onClick={onClick}>{label}</button>;
}
```

Alternative: Use `readonly` modifier on individual properties (more verbose):

```tsx
// ✅ ALSO GOOD: Individual readonly modifiers
interface ButtonProps {
  readonly label: string;
  readonly onClick: () => void;
}

function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}
```

## Preferred Approach

We prefer `Readonly<Props>` over individual `readonly` modifiers because:

1. **Less verbose** - one wrapper instead of marking each property
2. **Can't forget** - all properties are automatically read-only
3. **Easier refactoring** - adding new props doesn't require remembering to add `readonly`

## Inline Props Pattern

For components with inline props types:

```tsx
// ❌ BAD: Inline props not read-only
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// ✅ GOOD: Wrap inline props with Readonly<>
function Card({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

## Benefits

1. **Enforces immutability** - TypeScript will error if you try to mutate props
2. **Clear data flow** - props flow down, never modified by children
3. **Performance optimizations** - React can safely skip re-renders
4. **Self-documenting** - signals intent that props should not be changed

## Real Examples from Codebase

### Before (S6759 violation)

```tsx
// apps/admin/src/app/(dashboard)/evals/ab-tests/components/form-fields.tsx
function TestNameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label>Test Name</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
```

### After (Fixed)

```tsx
function TestNameField({
  value,
  onChange,
}: Readonly<{
  value: string;
  onChange: (v: string) => void;
}>) {
  return (
    <div>
      <label>Test Name</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
```

## Checklist

When writing React components:

- [ ] Wrap props type with `Readonly<>` for functional components
- [ ] For inline props, use `Readonly<{ ... }>` syntax
- [ ] For named interfaces, use `: Readonly<InterfaceName>` in function signature
