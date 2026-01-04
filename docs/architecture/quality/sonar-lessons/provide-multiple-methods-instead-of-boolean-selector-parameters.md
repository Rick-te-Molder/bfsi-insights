# Provide multiple methods instead of boolean selector parameters

**Rule**:
[Methods should not contain selector parameters](../sonar-rules/methods-should-not-contain-selector-parameters.md)

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
function processContent(content: string, type: ContentType)
{ ... }
processContent(data, 'pdf');  // Clear intent
```
