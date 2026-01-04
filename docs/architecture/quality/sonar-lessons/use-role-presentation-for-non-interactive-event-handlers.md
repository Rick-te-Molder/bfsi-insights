# Use role presentation for non-interactive event handlers

**Rule ID**: typescript:S6847  
**SonarCloud message**: "Non-interactive elements should not be assigned mouse or keyboard event listeners."  
**Aliases**: onMouseDown on div, onClick on span, event handler on non-interactive element

**Rule**: [Non-interactive elements shouldn't have event handlers](../sonar-rules/non-interactive-elements-shouldnt-have-event-handlers.md)

---

## Why this matters

Non-interactive HTML elements (`<div>`, `<span>`) are not designed for event handlers. Adding them can cause accessibility issues:

- Screen readers may not announce the element correctly
- Keyboard users may not be able to interact with it
- Focus management may be broken

---

## Pattern to avoid

```tsx
{
  /* BAD: Event handler on dialog div */
}
<div role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
  {children}
</div>;
```

## Fix — Use role="presentation" wrapper

When you need event handlers for layout purposes (like preventing event propagation), wrap in a presentation div:

```tsx
{
  /* GOOD: Presentation wrapper handles the event */
}
<div role="presentation" onMouseDown={(e) => e.stopPropagation()}>
  <div role="dialog" aria-modal="true">
    {children}
  </div>
</div>;
```

## Modal pattern

For modals that need to prevent backdrop clicks from closing when clicking inside:

```tsx
<button type="button" onClick={onClose} aria-label="Close modal">
  <div role="presentation" onMouseDown={(e) => e.stopPropagation()}>
    <div role="dialog" aria-modal="true">
      {children}
    </div>
  </div>
</button>
```

## Other compliant patterns

```tsx
{
  /* Interactive element - no role needed */
}
<button onClick={handleClick}>Click me</button>;

{
  /* Presentation role - for layout event handling */
}
<div role="presentation" onClick={() => void 0} />;

{
  /* aria-hidden - hidden from screen readers */
}
<div onClick={() => void 0} aria-hidden />;
```

## Key points

- `role="presentation"` indicates the element is purely for presentation/layout
- Use it when you need event handlers for non-interactive purposes (like stopPropagation)
- Keep semantic roles (`dialog`, `button`) on elements without event handlers when possible
