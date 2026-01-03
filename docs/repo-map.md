# Repository Map

## Overview

This repository is a monorepo containing:

- **Public website** (Astro)
- **Admin dashboard** (Next.js)
- **Agent API** (Node/Express service)
- **Infrastructure** (Supabase migrations/functions)

## Surfaces

| Surface         | Location              | Runtime | Primary commands                  |
| --------------- | --------------------- | ------- | --------------------------------- |
| Public website  | `apps/web/`           | Astro   | `npm run dev`, `npm run build`    |
| Admin dashboard | `apps/admin/`         | Next.js | `npm run dev -w admin`            |
| Agent API       | `services/agent-api/` | Node.js | `npm start -w services/agent-api` |

Deployment roots:

- Vercel: `apps/admin/`
- Cloudflare Pages: `apps/web/`

## Where "truth" lives

| Concern                 | Source of truth              |
| ----------------------- | ---------------------------- |
| Database schema         | `infra/supabase/migrations/` |
| Supabase Edge Functions | `infra/supabase/functions/`  |
| CI workflows            | `.github/workflows/`         |
| Docs index              | `docs/README.md`             |

## Shared code

| Package           | Purpose                 |
| ----------------- | ----------------------- |
| `packages/types/` | Shared TypeScript types |

## Scripts

Scripts are organized by safety and intent:

- `scripts/ci/` — Deterministic checks used by CI/hooks
- `scripts/dev/` — Local developer utilities
- `scripts/ops/` — Operational scripts (may touch production)
- `scripts/sql/` — Operational SQL and one-time SQL (see `scripts/sql/README.md`)

## Quick start

### Public website (Astro)

```bash
npm install
npm run dev
```

### Admin dashboard

```bash
npm install
npm run dev -w admin
```

### Agent API

```bash
npm install
npm start -w services/agent-api
```
