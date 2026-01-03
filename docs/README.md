# Documentation

Technical documentation for BFSI Insights using **Mermaid diagrams** (renders in GitHub).

## Quick Links

| Document                                                                            | Description                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Architecture](architecture/overview.md)                                            | System components, layers, security boundaries                           |
| [Data Model](data-model/schema.md)                                                  | ER diagram, tables, taxonomies                                           |
| [Repo Map](repo-map.md)                                                             | What runs where, where truth lives, how to start each surface            |
| [CI: Node + ESM Standardization](development/plans/gha-node-esm-standardization.md) | GitHub Actions determinism plan (Node version, ESM-explicit, workspaces) |
| [Repo Layout Improvements](development/plans/repo-layout-improvements.md)           | SQL hygiene, scripts reorg, monorepo enforcement, clarity                |

## Folder Structure

```
docs/
├── README.md
├── agents/
├── architecture/
├── data-model/
├── design/
├── development/
├── planning/
├── prompts/
├── quality/
├── refactoring/
└── security/
```

## Viewing Diagrams

All diagrams use **Mermaid** syntax which renders automatically on:

- GitHub (markdown files)
- VS Code (with Mermaid extension)
- Notion, GitLab, etc.

To view locally, install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) VS Code extension.
