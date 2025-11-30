# Architecture Diagrams

## high-level-architecture.png

**TODO:** Create a diagram showing:

```
┌─────────────────────────────────────────────────────────────────┐
│                         BFSI Insights                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐   │
│  │ Astro    │    │ Agent API    │    │ Supabase           │   │
│  │ Frontend │◄──►│ (Express)    │◄──►│ (Postgres + RLS)   │   │
│  └──────────┘    └──────────────┘    └────────────────────┘   │
│       │                │                      │                │
│       │                │                      │                │
│       ▼                ▼                      ▼                │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐   │
│  │Cloudflare│    │ OpenAI       │    │ Supabase Storage   │   │
│  │ Pages    │    │ GPT-4o-mini  │    │ (Thumbnails)       │   │
│  └──────────┘    └──────────────┘    └────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Components to show:

- Astro frontend (static + SSR)
- Agent API (Express server)
- Supabase (Postgres, Auth, Storage)
- GitHub Actions (nightly jobs)
- Cloudflare Pages (CDN)
- OpenAI API (LLM calls)
