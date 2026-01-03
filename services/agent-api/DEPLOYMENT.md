# BFSI Agent API

Hosted agent service for content processing pipeline.

## Deployment (Render)

### One-click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Rick-te-Molder/bfsi-insights)

### Manual Setup

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub repo: `Rick-te-Molder/bfsi-insights`
3. Configure:
   - **Root Directory:** `.`
   - **Build Command:** `npm ci -w services/agent-api --ignore-scripts && npm -w services/agent-api exec -- playwright install chromium --with-deps`
   - **Start Command:** `npm -w services/agent-api start`
   - **Plan:** Starter ($7/mo)

4. Add environment variables:

   | Variable               | Description                                            |
   | ---------------------- | ------------------------------------------------------ |
   | `PUBLIC_SUPABASE_URL`  | Your Supabase project URL                              |
   | `SUPABASE_SERVICE_KEY` | Service role key (not anon!)                           |
   | `OPENAI_API_KEY`       | OpenAI API key                                         |
   | `AGENT_API_KEY`        | Secret key for API auth (auto-generated or create one) |

## API Endpoints

All endpoints require `X-API-Key` header (except `/health`).

| Method | Endpoint                    | Description                 |
| ------ | --------------------------- | --------------------------- |
| GET    | `/health`                   | Health check (no auth)      |
| POST   | `/api/agents/run/discovery` | Run discovery agent         |
| POST   | `/api/agents/run/filter`    | Run relevance filter        |
| POST   | `/api/agents/run/summarize` | Run summarizer              |
| POST   | `/api/agents/run/tag`       | Run tagger                  |
| POST   | `/api/agents/run/thumbnail` | Generate thumbnails         |
| POST   | `/api/agents/process-queue` | Process pending queue items |
| POST   | `/api/agents/process-item`  | Process single item by ID   |

## Example Requests

### Health Check

```bash
curl https://your-app.onrender.com/health
```

### Process Queue (with auth)

```bash
curl -X POST https://your-app.onrender.com/api/agents/process-queue \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-agent-api-key" \
  -d '{"limit": 5, "includeThumbnail": true}'
```

### Process Single Item

```bash
curl -X POST https://your-app.onrender.com/api/agents/process-item \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-agent-api-key" \
  -d '{"id": "uuid-of-queue-item"}'
```

### Run Discovery

```bash
curl -X POST https://your-app.onrender.com/api/agents/run/discovery \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-agent-api-key" \
  -d '{"limit": 10}'
```

## Local Development

```bash
cd services/agent-api
npm install
npx playwright install chromium

# Copy and configure environment
cp .env.example .env
# Edit .env with your values

# Run in development mode (auto-reload)
npm run dev
```

## Environment Variables

| Variable               | Required  | Description                          |
| ---------------------- | --------- | ------------------------------------ |
| `PUBLIC_SUPABASE_URL`  | ✅        | Supabase project URL                 |
| `SUPABASE_SERVICE_KEY` | ✅        | Service role key for backend access  |
| `OPENAI_API_KEY`       | ✅        | OpenAI API key for agents            |
| `AGENT_API_KEY`        | ✅ (prod) | API authentication key               |
| `PORT`                 | ❌        | Server port (default: 3000)          |
| `NODE_ENV`             | ❌        | Environment (development/production) |

## Discovery Source Types

The discovery agent supports multiple source types in `kb_source`, tried in priority order:

| Field            | Type  | Description                                   |
| ---------------- | ----- | --------------------------------------------- |
| `rss_feed`       | URL   | RSS/Atom feed URL (fastest, most reliable)    |
| `sitemap_url`    | URL   | XML sitemap URL (parses sitemap index too)    |
| `scraper_config` | JSONB | Playwright scraper config (slowest, fallback) |

### Sitemap Features

- Parses standard XML sitemaps and sitemap indexes
- Respects `robots.txt` (disallow patterns, crawl-delay)
- Rate limiting: 1 second minimum between requests
- Filters for article-like URLs, excludes static assets

### Example Source Configuration

```sql
-- RSS source
UPDATE kb_source SET rss_feed = 'https://example.com/feed.xml' WHERE slug = 'example';

-- Sitemap source
UPDATE kb_source SET sitemap_url = 'https://example.com/sitemap.xml' WHERE slug = 'example';

-- Scraper source
UPDATE kb_source SET scraper_config = '{
  "url": "https://example.com/insights",
  "selectors": {
    "article": ".article-card",
    "title": "h2",
    "link": "a",
    "date": ".date"
  }
}'::jsonb WHERE slug = 'example';
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Admin Panel    │────▶│  Supabase DB     │────▶│  DB Trigger   │
│  (add URL)      │     │  ingestion_queue │     │  (pg_net)     │
└─────────────────┘     └──────────────────┘     └───────┬───────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent API (Render)                         │
│  ┌─────────┐  ┌────────────┐  ┌───────┐  ┌───────┐  ┌────────┐ │
│  │ Filter  │─▶│ Summarize  │─▶│  Tag  │─▶│Thumb- │─▶│Publish │ │
│  │         │  │            │  │       │  │ nail  │  │        │ │
│  └─────────┘  └────────────┘  └───────┘  └───────┘  └────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Supabase Integration

The Agent API uses the Supabase service role key for:

- Reading/writing `ingestion_queue`
- Creating publications in `kb_publication`
- Uploading thumbnails to Storage (`thumbnails` bucket)
- Reading agent configurations

Ensure RLS policies allow service role access.
