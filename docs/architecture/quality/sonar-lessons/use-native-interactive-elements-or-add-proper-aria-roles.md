# Use native interactive elements or add proper ARIA roles

**Rules**:

- [Non-interactive elements should not have interactive handlers](../sonar-rules/non-interactive-elements-should-not-have-interactive-handlers.md) (S6848)
- [Non-interactive DOM elements should not have interactive ARIA roles](../sonar-rules/non-interactive-dom-elements-should-not-have-interactive-aria-roles.md) (S6842)

**Pattern to avoid**:

```tsx
<div onClick={() => handleClick()}>Click me</div>
```

**Fix** (preferred) — Use native interactive element:

```tsx
<button onClick={() => handleClick()}>Click me</button>
```

**Fix** (if native not possible) — Add role + keyboard handling:

```tsx
<div
  onClick={handleClick}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>
```

**Modal pattern** — For modal backdrops that close on click:

```tsx
{
  /* Backdrop */
}
<div
  role="button"
  tabIndex={0}
  aria-label="Close modal"
  className="fixed inset-0 bg-black/50"
  onClick={onClose}
  onKeyDown={(e) => e.key === 'Escape' && onClose()}
>
  {/* Dialog */}
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    onClick={(e) => e.stopPropagation()}
  >
    <h2 id="modal-title">Title</h2>
    {children}
  </div>
</div>;
```
