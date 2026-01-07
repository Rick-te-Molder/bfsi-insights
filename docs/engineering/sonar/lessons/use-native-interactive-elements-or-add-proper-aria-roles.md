---
id: S6842
name: Interactive ARIA role without keyboard support
pattern: <div[^>]*role\s*=\s*["'](button|link)["'][^>]*>
extensions: ['.tsx', '.jsx']
---

# Do not add interactive ARIA roles to non-interactive elements

**Rule ID**: typescript:S6842  
**SonarCloud message**: "Non-interactive DOM elements should not have interactive ARIA roles"  
**Aliases**: role="button" on div without proper handling, ARIA role mismatch

**Rule**: [Non-interactive DOM elements should not have interactive ARIA roles](../sonar-rules/6842_non-interactive-dom-elements-should-not-have-interactive-aria-roles.md)

---

## Pattern to avoid

Adding an interactive role without proper keyboard/focus support:

```tsx
{
  /* BAD: has role but no keyboard handling */
}
<div role="button" onClick={handleClick}>
  Click me
</div>;
```

## Fix — Add complete accessibility support

If you add an interactive role, you MUST also add:

- `tabIndex={0}` for keyboard focus
- `onKeyDown` for keyboard activation
- `aria-label` if no visible text

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>
```

## Preferred — Use native elements

```tsx
<button onClick={handleClick}>Click me</button>
```
