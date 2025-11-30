# BPMN Diagrams

## ingestion-process.png

**TODO:** Create a BPMN diagram showing the content ingestion workflow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Content Ingestion Process                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────┐   ┌─────────┐   ┌───────────┐   ┌─────┐   ┌───────────┐  │
│  │Discovery│──►│ Filter  │──►│ Summarize │──►│ Tag │──►│ Thumbnail │  │
│  └─────────┘   └─────────┘   └───────────┘   └─────┘   └───────────┘  │
│       │             │              │            │             │         │
│       ▼             ▼              ▼            ▼             ▼         │
│   [queued]    [processing]   [processing]  [processing]  [enriched]    │
│                                                                          │
│                              ┌─────────┐                                │
│                              │ Review  │                                │
│                              └────┬────┘                                │
│                                   │                                      │
│                         ┌────────┴────────┐                            │
│                         ▼                 ▼                             │
│                    [approved]        [rejected]                         │
│                         │                                               │
│                         ▼                                               │
│                   [published]                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

Swimlanes to include:

- **System** (automated agents)
- **Admin** (human review)
- **External** (RSS feeds, OpenAI)
