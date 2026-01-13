---
description: Local PR Gate (Fast CI parity)
---

# Local PR Gate (Fast CI parity)

This repo treats local verification as the first-line quality gate.

Goal: the same checks you run locally are the checks that run in **Fast CI** on PRs.

## 1) Environment

- Node version is pinned via `.node-version` and `.nvmrc` (currently `20`).
- Use a Node version manager (recommended: `fnm`).

If you use `fnm`, make sure your shell initializes it:

```bash
eval "$(fnm env --use-on-cd)"
```

## 2) Local PR Gate command

Run this before creating a PR (and before pushing additional commits):

```bash
npm run pr:check
```

This mirrors Fast CI by running:

- `npm run lint -w admin`
- `npm run typecheck -w services/agent-api`
- `npm run validate:prompts -w services/agent-api`
- `npm run test:coverage -w services/agent-api`
- `npm run build:admin`

Note: PR CI may additionally run broader/root test coverage (allowed to be flaky/slow) after `npm run pr:check`.

## 3) Manual verification (when applicable)

If your change affects runtime behavior, also reproduce locally:

```bash
npm run dev -w admin
PORT=3001 npm run dev -w services/agent-api
```

Then verify the UI/API behavior you changed.

## 4) PR evidence

In the PR description, include evidence from:

- `npm run pr:check`
- any relevant manual repro steps
