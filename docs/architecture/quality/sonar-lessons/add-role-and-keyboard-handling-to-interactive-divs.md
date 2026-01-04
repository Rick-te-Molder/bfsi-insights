# Add role and keyboard handling to interactive divs

**Rule ID**: typescript:S6848  
**SonarCloud message**: "Avoid non-native interactive elements. If using native HTML is not possible, add an appropriate role and support for tabbing, mouse, keyboard, and touch inputs to an interactive content element."  
**Aliases**: onClick on div, interactive handler on non-interactive element, div with click handler

**Rule**: [Non-interactive elements should not have interactive handlers](../sonar-rules/6848_non-interactive-elements-should-not-have-interactive-handlers.md)

---

## Pattern to avoid

```tsx
<div onClick={() => handleClick()}>Click me</div>
```

## Fix (preferred) — Use native interactive element

```tsx
<button onClick={() => handleClick()}>Click me</button>
```

## Fix (if native not possible) — Add role + keyboard handling

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

## Modal backdrop pattern

For modal backdrops that close on click:

```tsx
{
  /* Backdrop - interactive, closes modal */
}
<div
  role="button"
  tabIndex={0}
  aria-label="Close modal"
  className="fixed inset-0 bg-black/50"
  onClick={onClose}
  onKeyDown={(e) => e.key === 'Escape' && onClose()}
>
  {/* Dialog content - use onMouseDown instead of onClick */}
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    onMouseDown={(e) => e.stopPropagation()}
  >
    <h2 id="modal-title">Title</h2>
    {children}
  </div>
</div>;
```

**Note**: Use `onMouseDown` instead of `onClick` for stopPropagation on dialog content to avoid S6848.
