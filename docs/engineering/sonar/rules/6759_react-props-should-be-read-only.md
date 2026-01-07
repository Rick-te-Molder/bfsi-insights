# S6759: React props should be read-only

**Rule:** [typescript:S6759](https://rules.sonarsource.com/typescript/RSPEC-6759/)

**Severity:** Low (Code Smell)

**Category:** Maintainability, Consistency

## Why it matters

React props should be read-only because it helps enforce the principle of immutability in React functional components. By making props read-only, you ensure that the data passed from a parent component to a child component cannot be modified directly by the child component. This helps maintain a clear data flow and prevents unexpected side effects.

If props were mutable, child components could modify the props directly, leading to unpredictable behavior and making it harder to track down bugs. By enforcing read-only props, React promotes a more predictable and maintainable codebase. Additionally, read-only props enable performance optimizations in React's rendering process by avoiding unnecessary re-renders of components.

## Lesson

See: [mark-react-props-as-read-only.md](../sonar-lessons/mark-react-props-as-read-only.md)
