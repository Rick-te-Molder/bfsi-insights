# ADR-001: TypeScript Strategy for services/agent-api

**Status:** Accepted  
**Date:** 2026-01-12  
**Decision Makers:** Architecture team

## Context

The `services/agent-api` service is the backend for BFSI Insights' AI-powered enrichment pipeline. It runs on Render as a Node.js service and handles LLM orchestration, content fetching, and pipeline state management.

### Current State (as of this ADR)

| Metric                                  | Value  |
| --------------------------------------- | ------ |
| JavaScript source files                 | 246    |
| JavaScript LoC                          | 26,650 |
| TypeScript implementation files (`.ts`) | 3      |
| TypeScript LoC                          | ~550   |
| Declaration files (`.d.ts`)             | 7      |

### Runtime Configuration

From `render.yaml`:

```yaml
buildCommand: npm ci -w services/agent-api --ignore-scripts && npm -w services/agent-api exec -- playwright install chromium --with-deps
startCommand: npm -w services/agent-api start
```

From `package.json`:

```json
{
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "typecheck": "tsc -p tsconfig.checkjs.json --noEmit"
  }
}
```

The `typecheck` script uses `tsconfig.checkjs.json` (not `tsconfig.json`):

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true
  },
  "files": ["src/cli/commands/pipeline.js"]
}
```

Note: `tsconfig.json` exists with broader `include` patterns but is **not used by any script**. The actual typecheck scope is currently limited to a single file.

### Key Observations

1. **No TS compilation in production**: Render runs `node src/index.js` directly. There is no build step that compiles TypeScript.

2. **Type-checking is narrow**: The `typecheck` script only covers `pipeline.js`. The 26k LoC codebase is largely unchecked.

3. **`.ts` implementation files are not executed**: Any `.ts` files in `src/` are invisible to both runtime (Node runs `.js`) and typecheck (config excludes `.ts`).

4. **Declaration files provide typed boundaries**: The existing `.d.ts` files (e.g., `orchestrator.js.d.ts`, CLI command declarations, `express.d.ts`) define contracts for JS modules without requiring migration.

## Decision

**Adopt a "JS runtime + typed boundaries" strategy for `services/agent-api`.**

This means:

1. **Runtime remains JavaScript**: All code that runs in production is `.js`. Node.js executes JavaScript directly without any TypeScript loader or compilation step.

2. **Type safety via JSDoc + declaration files**: Use JSDoc annotations in `.js` files and `.d.ts` declaration files to get TypeScript's static analysis benefits without changing the runtime.

3. **No `.ts` implementation files without a compile step**: TypeScript implementation files (`.ts`) should not exist in `src/` unless the deployment model includes TS compilation (see Alternative A). Without compilation, `.ts` files create confusion because they won't be executed and may drift from the actual `.js` runtime code.

4. **Tests may use TypeScript**: Test files can be `.ts` if the test runner supports it (Vitest does), but this is optional.

### What This Strategy Provides

| Capability                | How It's Achieved                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| Type checking             | `tsc --noEmit` with `checkJs: true`                                                             |
| IDE autocomplete          | JSDoc annotations + `.d.ts` files                                                               |
| Contract enforcement      | `.d.ts` files at module boundaries                                                              |
| Simple production runtime | Plain Node.js, no loaders or transpilation                                                      |
| Fast startup              | No JIT compilation overhead                                                                     |
| Debuggability             | Debug actual runtime code directly (source maps needed only if compilation is later introduced) |

### What This Strategy Does NOT Provide

| Capability                                                   | Why Not                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| True TypeScript syntax (generics, enums, interfaces in code) | Would require compilation or runtime loader                                     |
| Gradual TS migration path                                    | Not a goal for this service                                                     |
| Type-level features beyond JSDoc                             | JSDoc is sufficient for most use cases; complex types may require `.d.ts` files |

## Consequences

### Positive

- **No build step complexity**: Render deploys exactly what's in the repo.
- **No runtime dependencies on TS tooling**: No `tsx`, `ts-node`, or `esbuild` in production.
- **Matches existing architecture**: The service was designed this way; we're documenting it, not changing it.
- **Lower risk of TS/JS drift**: No parallel `.ts` and `.js` files that can diverge.

### Negative

- **JSDoc is more verbose than TS syntax**: Complex types require more boilerplate.
- **Some TS features unavailable**: No `as const`, no mapped types in code (only in `.d.ts`).
- **Cultural expectation mismatch**: Developers expecting TS may be surprised.

### Neutral

- **Declaration files can drift**: `.d.ts` files are manually maintained and may not match runtime behavior. Mitigate with runtime validation (e.g., Zod schemas) for critical inputs.

## Alternatives Considered

### Alternative A: Compile TS to JS for Production

```
┌──────────────┐    tsc     ┌──────────────┐    node    ┌──────────────┐
│   src/*.ts   │ ────────▶ │  dist/*.js   │ ────────▶ │   Runtime    │
└──────────────┘           └──────────────┘           └──────────────┘
```

**Pros:**

- Full TypeScript syntax support
- Single source of truth (`.ts` files only)

**Cons:**

- Requires build step in Render
- Source maps needed for debugging
- Increases deployment complexity
- Migration effort for 26k+ LoC

**Verdict:** Not adopted. The migration cost outweighs benefits for this service.

### Alternative B: TS Runtime Loader (tsx/ts-node)

```
┌──────────────┐   tsx/ts-node   ┌──────────────┐
│   src/*.ts   │ ─────────────▶ │   Runtime    │
└──────────────┘                └──────────────┘
```

**Pros:**

- No build step
- Can mix `.ts` and `.js`

**Cons:**

- Runtime dependency on TS tooling
- JIT compilation overhead at startup
- ESM/CJS compatibility issues
- Not recommended for production by ts-node maintainers

**Verdict:** Not adopted. Adds complexity and fragility for minimal benefit.

### Alternative C: Gradual Migration to TS

Start converting high-value modules to `.ts` while keeping the rest in `.js`.

**Pros:**

- Incremental improvement
- Can prioritize correctness-critical code

**Cons:**

- Requires choosing Alternative A or B for execution
- Mixed codebase harder to maintain
- No clear end state

**Verdict:** Not adopted. If we want TS, we should commit fully; partial migration creates ongoing maintenance burden.

## Recommendations

### Immediate Actions

1. **Eliminate non-executed implementation sources**: The files `idempotency.ts`, `retry-policy.ts`, and `retry-scheduler.ts` currently exist alongside their `.js` counterparts. For each:
   - Verify the `.js` version is the authoritative runtime code.
   - Either (a) delete the `.ts` version and add JSDoc types to the `.js`, or (b) adopt a compile step (Alternative A) and remove the `.js` duplicate.
   - Do not leave both `.ts` and `.js` for the same module.

2. **Expand typecheck scope**: The current `tsconfig.checkjs.json` only checks one file. Consider expanding to cover correctness-critical modules (orchestrator, state management, retry logic).

3. **Document JSDoc patterns**: Add examples of how to type complex structures using JSDoc in the coding practices doc.

### Sonar Implications

SonarCloud can leverage TypeScript's type information for certain rules (e.g., S4123 "await of non-Promise"). For this to work in a JS + checkJs setup:

- Ensure Sonar's `sonar.typescript.tsconfigPaths` points to the correct tsconfig.
- Rules that require type info will only apply to files covered by the tsconfig's `include` or `files`.

### Future Considerations

If the team later decides TypeScript implementation is valuable, the recommended path is:

1. Add a `build` script that compiles TS to `dist/`
2. Update `tsconfig.json` to emit and include `.ts` files
3. Update Render to run `npm run build` and start from `dist/`
4. Migrate incrementally, starting with new code

This ADR should be revisited if:

- The service grows significantly in complexity
- Team composition changes to favor TS expertise
- A major refactor is already planned

## References

- [TypeScript JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Node.js TypeScript Support](https://nodejs.org/en/learn/typescript/introduction)
- Existing `.d.ts` files: `src/types/express.d.ts`, `src/agents/orchestrator.js.d.ts`
