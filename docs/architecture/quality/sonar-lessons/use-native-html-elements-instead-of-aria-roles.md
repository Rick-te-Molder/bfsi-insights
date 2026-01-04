# Use native HTML elements instead of ARIA roles

**Rule ID**: typescript:S6819  
**SonarCloud messages**:

- "Use \<button> instead of the \"button\" role to ensure accessibility across all devices."
- "Use \<img alt=...> instead of the \"presentation\" role to ensure accessibility across all devices."  
  **Aliases**: div role="button", role="presentation", ARIA role instead of semantic HTML

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

## Modal backdrop pattern

For modal backdrops that close on click, use target check instead of stopPropagation:

```tsx
{
  /* GOOD: Check if click is on backdrop (not dialog) */
}
<button
  type="button"
  aria-label="Close modal"
  className="fixed inset-0 z-50 bg-black/50 w-full h-full border-none cursor-default"
  onClick={(e) => e.target === e.currentTarget && onClose()}
  onKeyDown={(e) => e.key === 'Escape' && onClose()}
>
  <div role="dialog" aria-modal="true">
    {children}
  </div>
</button>;
```

This eliminates the need for `role="presentation"` wrappers with stopPropagation.

## Avoid role="presentation" for event handling

```tsx
{
  /* BAD: Using presentation role for stopPropagation */
}
<div role="presentation" onMouseDown={(e) => e.stopPropagation()}>
  <div role="dialog">{children}</div>
</div>;

{
  /* GOOD: Use target check instead */
}
<button onClick={(e) => e.target === e.currentTarget && onClose()}>
  <div role="dialog">{children}</div>
</button>;
```

## Key points

- Always prefer `<button>` over `<div role="button">`
- Always prefer `<a href>` over `<div role="link">`
- ARIA roles are for cases where no suitable HTML element exists
