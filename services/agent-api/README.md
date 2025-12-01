# BFSI Agent API

Hosted agent service for content processing pipeline.

## Deployment (Render)

### One-click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Rick-te-Molder/bfsi-insights)

### Manual Setup

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub repo: `Rick-te-Molder/bfsi-insights`
3. Configure:
   - **Root Directory:** `services/agent-api`
   - **Build Command:** `npm install && npx playwright install chromium --with-deps`
   - **Start Command:** `npm start`
   - **Plan:** Starter ($7/mo)

4. Add environment variables:

   | Variable               | Description                                            |
   | ---------------------- | ------------------------------------------------------ |
   | `SUPABASE_URL`         | Your Supabase project URL                              |
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
| `SUPABASE_URL`         | ✅        | Supabase project URL                 |
| `SUPABASE_SERVICE_KEY` | ✅        | Service role key for backend access  |
| `OPENAI_API_KEY`       | ✅        | OpenAI API key for agents            |
| `AGENT_API_KEY`        | ✅ (prod) | API authentication key               |
| `PORT`                 | ❌        | Server port (default: 3000)          |
| `NODE_ENV`             | ❌        | Environment (development/production) |

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
