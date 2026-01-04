# Extract this nested ternary operation into an independent statement

**Rule ID**: typescript:S3358  
**SonarCloud message**: "Extract this nested ternary operation into an independent statement."  
**Aliases**: conditional button text, dynamic label, nested ternary in JSX

**Tip**: Use helper functions for conditional button labels

**Rule**: [Ternary operators should not be nested](../sonar-rules/3358_ternary-operators-should-not-be-nested.md)

## Context

Button labels often depend on multiple conditions (loading state, mode, permissions). Inline nested ternaries make JSX hard to read and violate S3358.

## Pattern to avoid

```tsx
function ModalFooter({ saving, mode }: { saving: boolean; mode: 'edit' | 'create' }) {
  // BAD: Nested ternary for button label
  const label = saving ? 'Saving...' : mode === 'create' ? 'Create Version' : 'Save Changes';
  return <button>{label}</button>;
}
```

## Fix: Extract to helper function with early returns

```tsx
function getSubmitButtonLabel(saving: boolean, mode: 'edit' | 'create'): string {
  if (saving) return 'Saving...';
  if (mode === 'create') return 'Create Version';
  return 'Save Changes';
}

function ModalFooter({ saving, mode }: { saving: boolean; mode: 'edit' | 'create' }) {
  const label = getSubmitButtonLabel(saving, mode);
  return <button>{label}</button>;
}
```

## Benefits

- **Readable**: Each condition is on its own line
- **Testable**: Helper function can be unit tested
- **Extensible**: Easy to add more conditions without nesting deeper

## Real example

From `PromptEditModal.tsx`:

```tsx
// Before (S3358 violation)
const label = saving ? 'Saving...' : mode === 'create' ? 'Create DEV Version' : 'Save Changes';

// After (fixed)
function getSubmitButtonLabel(saving: boolean, mode: 'edit' | 'create'): string {
  if (saving) return 'Saving...';
  if (mode === 'create') return 'Create DEV Version';
  return 'Save Changes';
}
const label = getSubmitButtonLabel(saving, mode);
```

## When to apply

Use this pattern whenever a button/label depends on:

- Loading/saving state + another condition
- Multiple modes (create/edit/view)
- Permission levels + state
- Any combination that would require nested ternaries
