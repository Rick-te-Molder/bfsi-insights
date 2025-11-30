# Data Flow Diagrams

## dfd-level-1.png

**TODO:** Create a Level 1 DFD showing data flows:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Flow Diagram (Level 1)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────┐                                    ┌──────────────┐      │
│   │ RSS Feed │──── URLs ────►┌────────────┐      │ kb_publication│      │
│   └──────────┘               │            │      └───────▲──────┘      │
│                              │  Agent API │             │              │
│   ┌──────────┐               │            │──enriched──►│              │
│   │  Admin   │──── URL ────► │ (Process)  │      ┌──────┴──────┐      │
│   └──────────┘               │            │      │ingestion_queue│      │
│                              └─────┬──────┘      └──────────────┘      │
│                                    │                                    │
│                              ┌─────▼──────┐                            │
│                              │  OpenAI    │                            │
│                              │ GPT-4o-mini│                            │
│                              └────────────┘                            │
│                                                                          │
│   ┌──────────┐               ┌────────────┐      ┌──────────────┐      │
│   │  Public  │◄── HTML ──────│   Astro    │◄─────│  Supabase    │      │
│   │  Users   │               │  Frontend  │      │  (Postgres)  │      │
│   └──────────┘               └────────────┘      └──────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

Data stores to show:

- `ingestion_queue` (processing pipeline)
- `kb_publication` (published content)
- `kb_source` (RSS feed configs)
- Supabase Storage (thumbnails)
