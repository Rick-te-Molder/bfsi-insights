# Unused React typed props should be removed (S6767)

## Rule Details

- **Rule ID**: S6767
- **Type**: Code Smell
- **Severity**: Low
- **Tags**: react
- **Effort**: 5 min

## Description

Leaving unused props in a React component can make the code harder to understand and maintain. Other developers may wonder why certain props are passed to a component if they are not used. Unused props can also increase the size of the component's memory footprint and impact performance, especially if the unused props are large objects or arrays.

Furthermore, if a prop is unused, it may indicate that the developer did not complete the implementation as intended or made a mistake while writing the component.

## Noncompliant Code Example

```tsx
interface Props {
  name: string;
  isAdmin: boolean; // Noncompliant - never used
}

function UserCard({ name }: Props) {
  return <div>{name}</div>;
}
```

## Compliant Solution

```tsx
interface Props {
  name: string;
}

function UserCard({ name }: Props) {
  return <div>{name}</div>;
}
```

## Known Issues / Limitations

False positives can occur when props are passed through to helper functions as an object without destructuring. In these cases, destructure the props explicitly to make usage clear to the analyzer.

## References

- [SonarSource TypeScript Rule S6767](https://rules.sonarsource.com/typescript/RSPEC-6767/)
