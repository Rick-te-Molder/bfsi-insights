# Cost Observability

This runbook describes how to inspect estimated LLM spend using the cost tracking primitives.

## CLI

Run the cost report for the last 7 days:

```
node services/agent-api/src/cli.js cost-report
```

Run the cost report for the last 3 days:

```
node services/agent-api/src/cli.js cost-report --days=3
```

## What the report shows

- Estimated spend per day (from `pipeline_run.estimated_cost_usd`)
- Estimated spend per agent (derived from `agent_run_metric` tokens metadata)
- Estimated spend per model (derived from `agent_run_metric` tokens metadata)

## Notes

- These numbers are **estimates** based on token counts.
- The report is designed to **fail open**: if an RPC fails, it prints a warning and continues.
- If you recently added/changed migrations, run `npm run dump:schema` to refresh `docs/data-model/schema.md`.
