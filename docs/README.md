# Documentation

Technical documentation for BFSI Insights.

---

## Navigation

### For New Contributors

Start here:

1. [Architecture Overview](architecture/overview.md) — System design, components, boundaries
2. [Engineering Practices](engineering/quality-system.md) — Quality governance, controls
3. [AI-Assisted Development](engineering/ai-assisted-development.md) — Guardrails for AI coding

### For Architects & Auditors

| Document                                            | Purpose                                |
| --------------------------------------------------- | -------------------------------------- |
| [Security Policy](security/cybersecurity-policy.md) | Governance, access control, compliance |
| [Threat Analysis](security/threat-analysis.md)      | STRIDE-based threat model              |
| [Security Design](security/security-design.md)      | Security architecture                  |
| [Quality System](engineering/quality-system.md)     | Quality controls C1-C18                |

### For Developers

| Document                                                          | Purpose                    |
| ----------------------------------------------------------------- | -------------------------- |
| [Coding Practices](engineering/coding-practices.md)               | Standards, patterns        |
| [Secure Coding](engineering/secure-coding.md)                     | Security guidelines        |
| [AI-Assisted Development](engineering/ai-assisted-development.md) | 14 dimensions + guardrails |
| [SonarCloud](engineering/sonar/sonarcloud.md)                     | Static analysis lessons    |

---

## Folder Structure

```
docs/
├── README.md                    # This file - navigation
│
├── architecture/                # WHAT the system is (stable)
│   ├── overview.md              # System context, C4-style
│   ├── decisions/               # Architecture Decision Records
│   ├── diagrams/                # Visual artifacts
│   └── *.md                     # Component docs
│
├── engineering/                 # HOW we build (evolving)
│   ├── quality-system.md        # Quality governance entry point
│   ├── ai-assisted-development.md  # AI coding guardrails
│   ├── coding-practices.md      # Standards, patterns
│   ├── secure-coding.md         # Security guidelines
│   └── sonar/                   # SonarCloud lessons/rules
│       ├── sonarcloud.md        # Quick lookup
│       ├── lessons/             # Fix patterns
│       └── rules/               # Links to SonarSource
│
├── security/                    # Security governance
│   ├── cybersecurity-policy.md  # Policy framework
│   ├── threat-analysis.md       # STRIDE threat model
│   ├── security-design.md       # Security architecture
│   └── third-party-data-flow.md # AI provider data handling
│
├── operations/                  # HOW we run
│   ├── runbooks/                # Operational procedures
│   └── incidents/               # Post-mortems
│
├── data-model/                  # Database schema
│   └── schema.md                # ER diagram, tables
│
├── agents/                      # AI agent configuration
│   └── manifest.yaml            # Agent registry
│
└── _archive/                    # Deprecated docs (historical)
```

---

## Key Documents by Topic

### Quality & Standards

- [Quality System](engineering/quality-system.md) — Controls C1-C18, governance
- [AI-Assisted Development](engineering/ai-assisted-development.md) — 14 dimensions
- [Coding Practices](engineering/coding-practices.md) — File/function size limits

### Security

- [Cybersecurity Policy](security/cybersecurity-policy.md) — Policy framework
- [Threat Analysis](security/threat-analysis.md) — STRIDE model
- [Security Design](security/security-design.md) — Architecture
- [Secure Coding](engineering/secure-coding.md) — Developer guidelines

### Architecture

- [Overview](architecture/overview.md) — System context
- [Pipeline Status Codes](architecture/pipeline-status-codes.md) — State machine
- [Data Model](data-model/schema.md) — Database schema

---

## Viewing Diagrams

All diagrams use **Mermaid** syntax which renders automatically on:

- GitHub (markdown files)
- VS Code (with Mermaid extension)
- Notion, GitLab, etc.

To view locally, install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) VS Code extension.
