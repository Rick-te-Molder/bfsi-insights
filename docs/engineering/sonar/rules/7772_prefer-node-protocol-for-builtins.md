# S7772: Node.js built-in modules should be imported using the node: protocol

## Rule Details

- **Rule ID**: S7772
- **Type**: Code Smell
- **Severity**: Medium
- **Category**: Maintainability, Consistency

## Description

Node.js built-in modules should be imported using the node: protocol prefix to make it explicitly clear that you are importing a core Node.js module rather than a third-party package from npm.

## Why

- Clarity: Immediately obvious the import refers to a Node.js built-in
- Security: Prevents potential confusion attacks with similarly-named npm packages
- Future-proofing: Aligns with modern Node.js and ESM best practices
- Consistency: Uniform approach across all built-in module imports

## Non-compliant

```typescript
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
```

## Compliant

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
```

## Links

- [SonarSource Rule](https://rules.sonarsource.com/typescript/RSPEC-7772)
- [Node.js ESM Documentation](https://nodejs.org/api/esm.html#node-imports)
- [eslint-plugin-unicorn prefer-node-protocol](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-node-protocol.md)

## Related Lessons

- [prefer-node-protocol-for-builtins.md](../lessons/prefer-node-protocol-for-builtins.md)
