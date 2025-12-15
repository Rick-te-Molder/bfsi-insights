# @bfsi/types

Shared TypeScript types for BFSI Insights.

## Usage

```typescript
import type { IngestionQueueItem, Publication, StatusCode } from '@bfsi/types';
import { STATUS_CODES } from '@bfsi/types';
```

## Available Types

### Ingestion Queue

- `IngestionQueueItem` - Item in the processing pipeline
- `QueuePayload` - Payload structure for queue items
- `SummarySection` - Long summary section structure
- `EnrichmentLogEntry` - Log entry from agent processing
- `NewIngestionQueueItem` - Type for inserting new items

### Publication

- `Publication` - Published article in kb_publication
- `PublicationPretty` - Joined view with taxonomy data
- `PublicationStatus` - 'draft' | 'published' | 'archived'

### Source

- `Source` - Content source configuration
- `SourceTier` - 'standard' | 'premium'

### Prompt

- `PromptVersion` - Agent prompt version
- `PromptABTest` - A/B test configuration
- `ABTestResults` / `ABTestMetrics` - Test results

### Eval

- `EvalRun` - Evaluation run record
- `EvalGoldenSet` - Golden test set
- `EvalResult` - Individual evaluation result

### Status

- `StatusLookup` - Status code definition
- `StatusCode` - Union of known status codes
- `STATUS_CODES` - Constant object with all status codes

## Development

```bash
# Build the package
npm run build

# Watch mode
npm run dev
```

## Adding New Types

1. Add type definitions to appropriate file in `src/`
2. Export from `src/index.ts`
3. Run `npm run build`
4. Import from `@bfsi/types` in consuming packages
