# Data Model Diagrams

## logical.png

**TODO:** Create an entity-relationship diagram showing:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Logical Data Model                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐         ┌──────────────────────┐                  │
│  │ kb_publication  │         │   ingestion_queue    │                  │
│  ├─────────────────┤         ├──────────────────────┤                  │
│  │ id (PK)         │         │ id (PK)              │                  │
│  │ slug            │         │ url                  │                  │
│  │ title           │         │ status               │                  │
│  │ summary_short   │         │ payload (JSONB)      │                  │
│  │ source_url      │         │ created_at           │                  │
│  │ thumbnail       │         └──────────────────────┘                  │
│  └────────┬────────┘                                                    │
│           │                                                              │
│           │ M:N                                                          │
│           │                                                              │
│  ┌────────┴────────┐                                                    │
│  │                 │                                                     │
│  ▼                 ▼                                                     │
│ ┌─────────────┐  ┌────────────┐  ┌─────────────┐  ┌─────────────┐      │
│ │bfsi_industry│  │ bfsi_topic │  │  ag_vendor  │  │  regulator  │      │
│ ├─────────────┤  ├────────────┤  ├─────────────┤  ├─────────────┤      │
│ │ id (PK)     │  │ id (PK)    │  │ id (PK)     │  │ id (PK)     │      │
│ │ code        │  │ code       │  │ name        │  │ code        │      │
│ │ name        │  │ name       │  │ slug        │  │ name        │      │
│ └─────────────┘  └────────────┘  └─────────────┘  └─────────────┘      │
│                                                                          │
│  Junction tables: kb_publication_bfsi_industry, kb_publication_bfsi_topic│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

Tables to include:

- Core: `kb_publication`, `ingestion_queue`, `kb_source`
- Taxonomies: `bfsi_industry`, `bfsi_topic`, `bfsi_geography`
- AI/Agentic: `ag_vendor`, `ag_use_case`, `ag_capability`
- Regulatory: `regulator`, `regulation`, `obligation`
- Junction tables for M:N relationships
