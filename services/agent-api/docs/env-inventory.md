# Agent API legacy env inventory (PUBLIC*SUPABASE*\*)

This file is a snapshot inventory used to drive the staged migration away from legacy env var names.

## Summary counts (current)

- `services/agent-api/src/**`
  - `PUBLIC_SUPABASE_*` occurrences: 49 matches across 42 files
- `services/agent-api/tests/**`
  - `PUBLIC_SUPABASE_*` occurrences: 26 matches across 7 files
- `services/agent-api` docs/config (`*.md`, `render.yaml`, `.env*`)
  - `PUBLIC_SUPABASE_*` occurrences: 11 matches across 4 files

Additionally (direct reads):

- `process.env.PUBLIC_SUPABASE_*` occurrences (all of `services/agent-api`): 68 matches across 48 files

## File list: `services/agent-api/src/**`

Top offenders by match count:

- `services/agent-api/src/env-shim.js` (4)
- `services/agent-api/src/lib/supabase.js` (3)
- `services/agent-api/src/lib/queue-update.js` (2)
- `services/agent-api/src/scripts/validate-agent-registry.js` (2)

Other files with matches (1 each):

- `services/agent-api/src/agents/discover-classics-db.js`
- `services/agent-api/src/agents/discoverer.js`
- `services/agent-api/src/agents/improver-config.js`
- `services/agent-api/src/agents/orchestrator.js`
- `services/agent-api/src/agents/scorer-prompt.js`
- `services/agent-api/src/agents/summarizer.js`
- `services/agent-api/src/agents/tagger-config.js`
- `services/agent-api/src/cli/commands/eval.js`
- `services/agent-api/src/cli/commands/fetch.js`
- `services/agent-api/src/cli/commands/filter.js`
- `services/agent-api/src/cli/commands/health.js`
- `services/agent-api/src/cli/commands/summarize.js`
- `services/agent-api/src/cli/commands/tag.js`
- `services/agent-api/src/cli/commands/thumbnail.js`
- `services/agent-api/src/index.js`
- `services/agent-api/src/lib/discovery-config.js`
- `services/agent-api/src/lib/discovery-queue.js`
- `services/agent-api/src/lib/embeddings.js`
- `services/agent-api/src/lib/evals-config.js`
- `services/agent-api/src/lib/pdf-extractor.js`
- `services/agent-api/src/lib/pipeline-tracking.js`
- `services/agent-api/src/lib/prompt-eval.js`
- `services/agent-api/src/lib/replay-helpers.js`
- `services/agent-api/src/lib/runner.js`
- `services/agent-api/src/lib/state-machine.js`
- `services/agent-api/src/lib/status-codes.js`
- `services/agent-api/src/lib/taxonomy-loader.js`
- `services/agent-api/src/lib/vendor-loader.js`
- `services/agent-api/src/lib/wip-limits.js`
- `services/agent-api/src/routes/agent-jobs.js`
- `services/agent-api/src/routes/agents/discovery.js`
- `services/agent-api/src/routes/agents/filter.js`
- `services/agent-api/src/routes/agents/summarize.js`
- `services/agent-api/src/routes/agents/tag.js`
- `services/agent-api/src/routes/agents/thumbnail.js`
- `services/agent-api/src/routes/discovery-control.js`
- `services/agent-api/src/routes/evals.js`
- `services/agent-api/src/scripts/utils.js`

## File list: `services/agent-api/tests/**`

- `services/agent-api/tests/lib/env-shim.spec.js` (9)
- `services/agent-api/tests/lib/supabase.spec.js` (7)
- `services/agent-api/tests/lib/queue-update.spec.js` (6)
- `services/agent-api/tests/agents/tagger.spec.js` (1)
- `services/agent-api/tests/evals/run-eval.js` (1)
- `services/agent-api/tests/lib/pdf-extraction.test.js` (1)
- `services/agent-api/tests/lib/replay-helpers.spec.js` (1)

## Docs/config files with matches

- `services/agent-api/DEPLOYMENT.md` (4)
- `services/agent-api/.env.example` (3)
- `services/agent-api/.env.local` (2)
- `services/agent-api/render.yaml` (2)
