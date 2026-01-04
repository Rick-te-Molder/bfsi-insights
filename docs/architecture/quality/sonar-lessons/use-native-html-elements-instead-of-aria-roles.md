# Use native HTML elements instead of ARIA roles

**Rule ID**: typescript:S6819  
**SonarCloud messages**:

- "Use \<button> instead of the \"button\" role to ensure accessibility across all devices."
- "Use \<img alt=...> instead of the \"presentation\" role to ensure accessibility across all devices."
- "Use \<dialog> instead of the \"dialog\" role to ensure accessibility across all devices."  
  **Aliases**: div role="button", role="presentation", role="dialog", ARIA role instead of semantic HTML

**Rule**: [Prefer tag over ARIA role](../sonar-rules/prefer-tag-over-aria-role.md)

---

## Why this matters

Semantic HTML elements like `<button>` have built-in accessibility support:

- Keyboard navigation (focus, Enter/Space to activate)
- Screen reader announcements
- Universal browser support

ARIA roles are a fallback, not a replacement for semantic HTML.

---

## Pattern to avoid

```tsx
{
  /* BAD: Using ARIA role instead of native element */
}
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>;
```

## Fix — Use native element

```tsx
{
  /* GOOD: Native button with built-in accessibility */
}
<button type="button" onClick={handleClick}>
  Click me
</button>;
```

## Modal pattern — Use native dialog

```tsx
{
  /* BAD: Using role="dialog" */
}
<div role="dialog" aria-modal="true">
  {children}
</div>;

{
  /* GOOD: Native dialog element */
}
<dialog open aria-modal="true">
  {children}
</dialog>;
```

## Modal backdrop with target check

```tsx
<button
  type="button"
  aria-label="Close modal"
  onClick={(e) => e.target === e.currentTarget && onClose()}
  onKeyDown={(e) => e.key === 'Escape' && onClose()}
>
  <dialog open aria-modal="true">
    {children}
  </dialog>
</button>
```

## Avoid role="presentation" — Use aria-hidden

When you need event handlers on non-interactive elements:

```tsx
{
  /* BAD: role="presentation" triggers S6819 */
}
<div role="presentation" onMouseDown={(e) => e.stopPropagation()}>
  {children}
</div>;

{
  /* GOOD: aria-hidden satisfies both S6819 and S6847 */
}
<div onMouseDown={(e) => e.stopPropagation()} aria-hidden>
  {children}
</div>;
```

## Key points

- Always prefer `<button>` over `<div role="button">`
- Always prefer `<dialog>` over `<div role="dialog">`
- Always prefer `<a href>` over `<div role="link">`
- Use `aria-hidden` instead of `role="presentation"` for event handling
- ARIA roles are for cases where no suitable HTML element exists
