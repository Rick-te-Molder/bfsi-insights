# Documentation

Technical documentation for BFSI Insights using **Mermaid diagrams** (renders in GitHub).

## Quick Links

| Document                               | Description                                    |
| -------------------------------------- | ---------------------------------------------- |
| [Architecture](architecture/README.md) | System components, layers, security boundaries |
| [BPMN](bpmn/README.md)                 | Content ingestion workflow, status flow        |
| [DFD](dfd/README.md)                   | Data flow through the system                   |
| [Data Model](data-model/README.md)     | ER diagram, tables, taxonomies                 |

## Folder Structure

```
docs/
├── README.md              # This file
├── architecture/          # System architecture
├── bpmn/                  # Business process diagrams
├── dfd/                   # Data flow diagrams
└── data-model/            # Database schema
```

## Viewing Diagrams

All diagrams use **Mermaid** syntax which renders automatically on:

- GitHub (markdown files)
- VS Code (with Mermaid extension)
- Notion, GitLab, etc.

To view locally, install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) VS Code extension.
