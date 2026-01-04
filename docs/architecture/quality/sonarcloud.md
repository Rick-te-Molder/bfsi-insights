# SonarCloud Quality Standards

---

**Version**: 1.1.0  
**Last updated**: 2026-01-04  
**Quality System Control**: C7 (Static analysis)  
**Change history**:

- 1.1.0 (2026-01-04): Restructured to Prevention Checklist + Lessons Learned + Rule Index (no duplication of SonarSource docs).
- 1.0.0 (2026-01-04): Initial version.

---

This document captures SonarCloud patterns we've encountered and how to prevent them.

**Update policy**: This document MUST be updated every time we solve a SonarCloud issue:

1. Update the Prevention Checklist if a new pattern emerges
2. Add a Lessons Learned entry with our fix pattern
3. Add the rule to the Rule Index with a link to SonarSource

**Full rule catalog**: [SonarSource TypeScript Rules]
https://rules.sonarsource.com/typescript/ | 427 rules
https://rules.sonarsource.com/javascript/ | 422 rules
https://rules.sonarsource.com/githubactions/ | 26 rules

---

# Prevention Checklist

Quick checks before committing. If you're about to write any of these patterns, stop and refactor.

- [ ] **No nested ternaries** — Extract to helper function with early returns
- [ ] **No boolean selector parameters** — Use separate methods or union types
- [ ] **Interactive handlers on interactive elements only** — Use `<button>`, not `<div onClick>`
- [ ] **No code duplication** — Extract shared logic to functions/components
- [ ] **No overly complex functions** — Keep cyclomatic complexity low

---

# Lessons Learned

Project-specific patterns derived from fixing real issues. Each entry shows what to do in our codebase.

---

## Extract nested ternary operations into helper functions

**Rule**:
typescript:S3358
Ternary operators should not be nested
https://rules.sonarsource.com/typescript/RSPEC-3358/

**Pattern to avoid**:

```tsx
const color = status === 'running' ? 'green' : status === 'completed' ? 'blue' : 'gray';
```

**Fix**: Extract to helper function with early returns:

```tsx
function getStatusColor(status: string): string {
  if (status === 'running') return 'green';
  if (status === 'completed') return 'blue';
  return 'gray';
}

const color = getStatusColor(status);
```

**Exception**: Nested ternaries in JSX are acceptable when nesting happens in separate `{}` containers.

---

## Provide multiple methods instead of boolean selector parameters

**Rule**:
typescript:S2301
Methods should not contain selector parameters
https://rules.sonarsource.com/typescript/RSPEC-2301/

**Pattern to avoid**:

```ts
function processContent(content: string, isPdf: boolean) {
  if (isPdf) {
    /* PDF */
  } else {
    /* HTML */
  }
}
processContent(data, true); // What does true mean?
```

**Fix Option 1** — Separate methods:

```ts
function processPdfContent(content: string) {
  /* PDF */
}
function processHtmlContent(content: string) {
  /* HTML */
}
processPdfContent(data); // Clear intent
```

**Fix Option 2** — Union type:

```ts
type ContentType = 'pdf' | 'html';
function processContent(content: string, type: ContentType) { ... }
processContent(data, 'pdf');  // Clear intent
```

---

## Use native interactive elements or add proper ARIA roles

**Rule**:
typescript:S6842
Non-interactive DOM elements should not have interactive ARIA roles
https://rules.sonarsource.com/typescript/RSPEC-6842/

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

---

# Rule Index

Rules we've encountered. Links to authoritative SonarSource documentation.

```
RULE ID            SUMMARY
─────────────────────────────────────────────────────────────────────────────
typescript:S3358   Ternary operators should not be nested
typescript:S2301   Methods should not contain selector parameters
typescript:S6848   Non-interactive elements should not have interactive handlers
typescript:S6842   Non-interactive DOM elements should not have interactive ARIA roles
```

**Links**:

- S3358: https://rules.sonarsource.com/typescript/RSPEC-3358/
- S2301: https://rules.sonarsource.com/typescript/RSPEC-2301/
- S6848: https://rules.sonarsource.com/typescript/RSPEC-6848/
- S6842: https://rules.sonarsource.com/typescript/RSPEC-6842/
