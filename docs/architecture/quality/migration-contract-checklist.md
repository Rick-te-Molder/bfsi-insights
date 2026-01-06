---
description: Migration Contract Checklist
---

## Contract-change checklist (use before/after migrations)

1. **State the observed failure mode**
   - **Static**: typecheck/checkJs/lint error
   - **Runtime**: thrown exception / crash
   - **Behavior**: output shape/semantics changed (wrong or unexpected results)

2. **Identify the contract boundary**
   - Which exported function / module is the boundary? (e.g. `runDiscovery()`)
   - Which callers depend on it? (routes, CLI commands, agents)

3. **Document the intended return shape**
   - Add/confirm a short doc comment (or JSDoc) describing the return shape for:
     - the internal impl (e.g. `runDiscoveryImpl(...)`)
     - the public wrapper (e.g. `runDiscovery(...)`)

4. **Choose the compatibility strategy**
   - **Option A (compat layer)**: keep wrapper return shape stable for callers; adapt internal impl changes inside wrapper.
   - **Option B (caller adapts)**: update callers to new internal shape, but keep external API behavior stable.

5. **Add a quick verification**
   - Add/update one focused test or fixture that asserts the outward contract remains correct.
   - If a route is involved, assert the JSON response contains the expected shape.

6. **Consistency check for shared dependencies**
   - If passing a Supabase client (or other shared dependency), ensure callers do not also create their own client.

7. **Final audit**
   - Run `rg`/grep for old identifiers (e.g. `PUBLIC_SUPABASE_`, `createClient(`).
   - Confirm lint/typecheck/test are green.
