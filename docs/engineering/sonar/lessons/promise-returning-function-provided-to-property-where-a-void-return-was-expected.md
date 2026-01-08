# Promise-returning function provided to property where a void return was expected (S6544)

## The Problem

This lesson documents one common manifestation of rule **S6544 (Promises should not be misused)**:
a Promise-returning function is provided to a property/callback that expects a `void` return.

When a function returns a Promise (including `async` functions), passing it to a context that expects `void` can cause issues:

- Unhandled promise rejections
- Race conditions from fire-and-forget async operations
- TypeScript type mismatches

Common scenarios:

- Event handlers like `onClick` expect `() => void`
- Callback props that don't expect async behavior

## Fix Patterns

### Pattern 1: Block Body (Recommended)

Use a block body to avoid returning the Promise:

```tsx
// ❌ BAD: Arrow function implicitly returns the Promise
onApprove: () => handleAction('approve'),

// ✅ GOOD: Block body doesn't return the Promise
onApprove: () => {
  handleAction('approve');
},
```

### Pattern 2: Accept Promise in Type Signature

When defining callbacks that may receive async functions, accept both:

```tsx
// ❌ BAD: Only accepts void return
deleteVersion: (p: PromptVersion) => void;

// ✅ GOOD: Accepts both sync and async
deleteVersion: (p: PromptVersion) => void | Promise<void>;
```

### Pattern 3: Void Operator (Use Sparingly)

The `void` operator explicitly discards the return value:

```tsx
// Works but may trigger other Sonar warnings
onClick: () => void handleAsync();
```

## Real Examples from This Codebase

### detail-panel.tsx

```tsx
// Before (S6544 warning)
actions: {
  onApprove: () => item?.status_code === 300 && handleAction('approve'),
  onReject: () => [300, 500].includes(item?.status_code || 0) && handleAction('reject'),
}

// After (fixed)
actions: {
  onApprove: () => {
    if (item?.status_code === 300) handleAction('approve');
  },
  onReject: () => {
    if ([300, 500].includes(item?.status_code || 0)) handleAction('reject');
  },
}
```

### agent-detail-handlers.ts

```tsx
// Before (type mismatch)
deleteVersion: (p: PromptVersion) => void;

// After (accepts async)
deleteVersion: (p: PromptVersion) => void | Promise<void>;
```

## When This Rule Applies

- Passing async functions to event handlers (`onClick`, `onSubmit`, etc.)
- Callback props in React components
- Any function parameter typed as returning `void`

## Files Fixed

- `apps/admin/src/app/(dashboard)/items/detail-panel.tsx`
- `apps/admin/src/app/(dashboard)/agents/[agent]/agent-detail-handlers.ts`
