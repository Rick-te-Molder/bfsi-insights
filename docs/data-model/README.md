# Data Model

## Overview

The database uses Supabase (Postgres) with Row Level Security (RLS).

## Entity Relationship Diagram

```mermaid
erDiagram
    kb_publication ||--o{ kb_publication_bfsi_industry : has
    kb_publication ||--o{ kb_publication_bfsi_topic : has
    kb_publication ||--o{ kb_publication_ag_vendor : mentions
    kb_publication ||--o{ kb_publication_bfsi_organization : mentions

    bfsi_industry ||--o{ kb_publication_bfsi_industry : categorizes
    bfsi_topic ||--o{ kb_publication_bfsi_topic : categorizes
    ag_vendor ||--o{ kb_publication_ag_vendor : referenced_in
    bfsi_organization ||--o{ kb_publication_bfsi_organization : referenced_in

    kb_publication {
        uuid id PK
        string slug UK
        string title
        string summary_short
        string summary_medium
        string source_url
        string thumbnail_path
        string status
        timestamp date_published
    }

    ingestion_queue {
        uuid id PK
        string url UK
        string status
        jsonb payload
        timestamp created_at
    }

    bfsi_industry {
        uuid id PK
        string code UK
        string name
    }

    bfsi_topic {
        uuid id PK
        string code UK
        string name
    }

    ag_vendor {
        uuid id PK
        string slug UK
        string name
    }

    regulator {
        uuid id PK
        string code UK
        string name
    }

    regulation {
        uuid id PK
        string code UK
        string name
        uuid regulator_id FK
    }
```

## Table Categories

### Core Tables

| Table                   | Purpose                     |
| ----------------------- | --------------------------- |
| `kb_publication`        | Published content           |
| `kb_publication_pretty` | Flattened view for frontend |
| `ingestion_queue`       | Processing pipeline         |
| `kb_source`             | RSS feed configurations     |

### Guardrail Taxonomies (curated, fixed)

| Table            | Rows | Purpose            |
| ---------------- | ---- | ------------------ |
| `bfsi_industry`  | 53   | Banking sectors    |
| `bfsi_topic`     | 5    | Content categories |
| `bfsi_geography` | —    | Countries/regions  |
| `ag_use_case`    | 16   | AI use cases       |
| `ag_capability`  | 24   | AI capabilities    |
| `regulator`      | 18   | Regulatory bodies  |
| `regulation`     | 18   | Laws/regulations   |

### Expandable Taxonomies (grow from content)

| Table               | Rows | Purpose         |
| ------------------- | ---- | --------------- |
| `bfsi_organization` | 8    | Banks, insurers |
| `ag_vendor`         | 81   | AI/tech vendors |

### Junction Tables (M:N)

| Table                              | Links                       |
| ---------------------------------- | --------------------------- |
| `kb_publication_bfsi_industry`     | Publication ↔ Industry     |
| `kb_publication_bfsi_topic`        | Publication ↔ Topic        |
| `kb_publication_ag_vendor`         | Publication ↔ Vendor       |
| `kb_publication_bfsi_organization` | Publication ↔ Organization |
