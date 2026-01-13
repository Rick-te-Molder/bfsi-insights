# Local PR Gate (Fast CI parity)

Goal: reduce PR churn (“branch #7”), make PRs higher-signal, and minimize trial-and-error by requiring local verification before pushing.

## Summary

Treat **local verification** as the first gate, and ensure it matches **Fast CI**.

This repo uses a single entrypoint command so that:

- what you run locally is the same as what CI runs on PRs
- reviewers can trust PRs have already been exercised
- PR iteration focuses on correctness, not environment drift

## Required before opening a PR

1. **Reproduce the issue locally** (if applicable) and confirm the fix.
2. Run the PR gate:

```bash
npm run pr:check
```

3. In the PR description, include evidence:

- `npm run pr:check` output excerpt
- manual repro steps + proof (screenshots/logs) when behavior changes are involved

## What `npm run pr:check` covers

`npm run pr:check` is the **Fast CI parity** command. It is intended to be quick, deterministic, and run on every PR.

It runs:

- `npm run lint -w admin`
- `npm run typecheck -w services/agent-api`
- `npm run validate:prompts -w services/agent-api`
- `npm run test:coverage -w services/agent-api`
- `npm run build:admin`

Note: PR CI may also run additional broader checks after the gate (e.g. optional root coverage), but the expectation is that the PR is already high-confidence once the gate passes.

## Environment consistency

To avoid “works on my machine” drift:

- Node is pinned via `.node-version` and `.nvmrc` (currently `20`).
- Use a Node version manager (recommended) so local Node matches CI.

## Why this reduces PR churn

- **Faster feedback loop**: you catch integration issues before pushing.
- **Same contract everywhere**: local and CI enforce the same gate.
- **Better PR discipline**: PRs contain proof, not just intent.
