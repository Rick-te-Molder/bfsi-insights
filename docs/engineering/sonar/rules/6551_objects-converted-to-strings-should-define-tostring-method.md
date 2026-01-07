# S6551: Objects and classes converted or coerced to strings should define a "toString()" method

**Rule ID**: typescript:S6551  
**Type**: Code Smell  
**Severity**: Low  
**Effort**: 5 min

## Description

When calling `toString()` or coercing an object into a string that doesn't implement its own `toString` method, it returns `[object Object]` which is often not what was intended.

## Why is this an issue?

When using an object in a string context, a developer wants to get the string representation of the state of an object. Obtaining `[object Object]` is probably not the intended behaviour and might even denote a bug.

## Noncompliant code example

```typescript
const foo = {};

foo + ''; // Noncompliant - evaluates to "[object Object]"
`Foo: ${foo}`; // Noncompliant - evaluates to "Foo: [object Object]"
foo.toString(); // Noncompliant - evaluates to "[object Object]"
```

## Compliant solution

```typescript
// Option 1: Define a toString method
const foo = {
  toString: () => {
    return 'foo';
  },
};

foo + '';
`Foo: ${foo}`;
foo.toString();

// Option 2: Use type guards before coercion
const val: unknown = getData();
const text = typeof val === 'string' ? val : JSON.stringify(val);
```

## See also

- [SonarSource Rule](https://rules.sonarsource.com/typescript/RSPEC-6551/)
