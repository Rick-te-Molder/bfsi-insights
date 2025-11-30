# Documentation

Technical documentation for BFSI Insights using **Mermaid diagrams** (renders in GitHub).

## Quick Links

| Document                                 | Description                                    |
| ---------------------------------------- | ---------------------------------------------- |
| [Architecture](architecture/overview.md) | System components, layers, security boundaries |
| [BPMN](bpmn/process-diagrams.md)         | Content ingestion workflow, status flow        |
| [DFD](dfd/data-flows.md)                 | Data flow through the system                   |
| [Data Model](data-model/schema.md)       | ER diagram, tables, taxonomies                 |

## Folder Structure

```
docs/
├── index.md               # This file
├── architecture/          # System architecture
├── bpmn/                  # Business process diagrams
├── dfd/                   # Data flow diagrams
├── data-model/            # Database schema
└── quality/               # Quality policies (Sonar exclusions, etc.)
```

## Viewing Diagrams

All diagrams use **Mermaid** syntax which renders automatically on:

- GitHub (markdown files)
- VS Code (with Mermaid extension)
- Notion, GitLab, etc.

To view locally, install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) VS Code extension.
