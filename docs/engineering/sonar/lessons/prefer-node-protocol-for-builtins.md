# Prefer node: Protocol for Built-in Modules

## Rule

S7772 - Node.js built-in modules should be imported using the node: protocol

## Problem

Importing Node.js built-in modules without the node: prefix:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import { createServer } from 'http';
```

## Why It Matters

1. **Clarity**: Makes it immediately obvious the import refers to a Node.js built-in module
2. **Security**: Prevents confusion attacks where malicious packages have names similar to built-in modules
3. **Future-proofing**: Aligns with Node.js best practices and ESM standards
4. **Consistency**: Creates a uniform way to reference all built-in modules

Without the node: prefix, it can be ambiguous whether `import fs from 'fs'` refers to the built-in file system module or a potential npm package named 'fs'.

## Fix

Add the node: prefix to all Node.js built-in module imports:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
```

## Common Built-in Modules

- node:fs, node:path, node:http, node:https
- node:crypto, node:buffer, node:stream
- node:url, node:querystring, node:util
- node:os, node:child_process, node:events

## When It Applies

- All TypeScript/JavaScript files that import Node.js built-in modules
- Both CommonJS and ESM module systems (node: protocol works in both)
- Node.js 12.20.0+ and 14.13.1+ (when the protocol was stabilized)

## Related

- ESLint plugin: eslint-plugin-unicorn (rule: prefer-node-protocol)
- Node.js ESM Documentation
