# Use globalThis instead of deprecated global APIs (S1874)

**Rule**: [S1874 - Deprecated APIs should not be used](../rules/1874_deprecated-apis-should-not-be-used.md)

---

## Problem

SonarCloud flags direct usage of `document`, `window`, and other global objects as deprecated in favor of the standardized `globalThis` API. Using deprecated global references can cause issues in cross-environment code and goes against modern JavaScript standards.

**Example violation**:

```typescript
function setupListeners() {
  document.addEventListener('mousemove', handler);
  window.innerHeight;
  document.body.style.cursor = 'pointer';
}
```

---

## Solution

Replace all direct global object references with `globalThis` prefix:

**Fixed code**:

```typescript
function setupListeners() {
  globalThis.document.addEventListener('mousemove', handler);
  globalThis.innerHeight;
  globalThis.document.body.style.cursor = 'pointer';
}
```

---

## Pattern in this codebase

### Before (deprecated)

```typescript
function calculateConstrainedHeight(newHeight: number, minHeight: number, maxOffset: number) {
  return Math.max(minHeight, Math.min(newHeight, window.innerHeight - maxOffset));
}

function setDraggingCursor(isDragging: boolean) {
  document.body.style.cursor = isDragging ? 'row-resize' : '';
  document.body.style.userSelect = isDragging ? 'none' : '';
}

function setupMouseListeners(...) {
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}
```

### After (using globalThis)

```typescript
function calculateConstrainedHeight(newHeight: number, minHeight: number, maxOffset: number) {
  return Math.max(minHeight, Math.min(newHeight, globalThis.innerHeight - maxOffset));
}

function setDraggingCursor(isDragging: boolean) {
  globalThis.document.body.style.cursor = isDragging ? 'row-resize' : '';
  globalThis.document.body.style.userSelect = isDragging ? 'none' : '';
}

function setupMouseListeners(...) {
  globalThis.document.addEventListener('mousemove', handleMouseMove);
  globalThis.document.addEventListener('mouseup', handleMouseUp);
  return () => {
    globalThis.document.removeEventListener('mousemove', handleMouseMove);
    globalThis.document.removeEventListener('mouseup', handleMouseUp);
  };
}
```

---

## Why this matters

1. **Cross-environment compatibility**: `globalThis` works in Node.js, browsers, workers, and other JavaScript environments
2. **Standards compliance**: `globalThis` is the ECMAScript standard (ES2020+) for accessing the global object
3. **Future-proofing**: Direct global references may be deprecated in future JavaScript versions
4. **Consistency**: Using `globalThis` makes it explicit that you're accessing global scope

---

## Related rules

- S7764: Prefer globalThis over window (specific case of this rule)
- S7772: Prefer node: protocol for Node.js built-in imports

---

## Files fixed

- `apps/admin/src/app/(dashboard)/agents/hooks/useResizablePanel.ts`

---

**Status**: ✅ Fixed  
**Date**: 2026-01-28
