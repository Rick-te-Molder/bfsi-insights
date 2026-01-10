# Prompt Sensitive Data Handling Policy

> **US 9.2**: Guardrails that prevent accidental inclusion of secrets/PII in prompts.

## Overview

This document defines the policy for what content can be included in prompts sent to LLM providers (OpenAI, Anthropic). It ensures secrets are never embedded and provides transparency about when raw content is sent.

## Content Categories

### Allowed in Prompts

| Category             | Description                                    | Example                     |
| -------------------- | ---------------------------------------------- | --------------------------- |
| **Public metadata**  | Title, URL, publication date, source name      | Article title, website URL  |
| **Public content**   | Article text, summaries, descriptions          | News article body text      |
| **Taxonomy data**    | Classification codes from DB                   | Industry codes, topic codes |
| **Writing rules**    | Style guidelines from DB                       | Summary formatting rules    |
| **Prompt templates** | Stored prompt text from `prompt_version` table | System prompts              |

### Never Allowed in Prompts

| Category                 | Why              | Enforcement                                           |
| ------------------------ | ---------------- | ----------------------------------------------------- |
| **API keys**             | Security risk    | Keys loaded from env vars, passed to SDK clients only |
| **Database credentials** | Security risk    | Never referenced in prompt construction code          |
| **Internal URLs**        | Security risk    | Only public URLs from `payload.url`                   |
| **User passwords**       | Security/privacy | No user auth data flows through agents                |

## Prompt Construction Paths

All LLM calls flow through these entry points:

| Agent           | File                    | Content Sent                        |
| --------------- | ----------------------- | ----------------------------------- |
| **Summarizer**  | `summarizer.helpers.js` | title, url, textContent             |
| **Tagger**      | `tagger-prompt.js`      | title, summary, url, taxonomy lists |
| **Scorer**      | `scorer.js`             | source, title, description          |
| **Evals Judge** | `evals-judge.js`        | input/output JSON for comparison    |

## Secret Handling

Secrets are managed securely:

```
┌─────────────────────────────────────────────────────────────┐
│  Environment Variables                                       │
│  ├─ OPENAI_API_KEY                                          │
│  ├─ ANTHROPIC_API_KEY                                       │
│  └─ SUPABASE_SERVICE_KEY                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  llm.js - getOpenAI() / getAnthropic()                      │
│  - Keys passed to SDK client constructors                   │
│  - Never concatenated into prompt strings                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  LLM API Call                                               │
│  - SDK handles auth headers                                 │
│  - Prompt contains only allowed content                     │
└─────────────────────────────────────────────────────────────┘
```

## Logging

When content is sent to an LLM, the system logs:

1. **Content type** - What category of content is being sent
2. **Content length** - Size of the content (not the content itself)
3. **Sanitization status** - Whether PII redaction was applied

Example log output:

```
📤 [summarizer] Sending to LLM: title=67 chars, url=45 chars, content=12847 chars (raw, no PII redaction)
```

## PII Handling

### Current Status: Not Implemented

PII detection and redaction is **not yet implemented**. This means:

- Raw article content (titles, summaries, body text) is sent to LLM providers
- Content from public web sources may contain names, emails, or other PII
- This is acceptable for Phase 0 because:
  - Content is from public news/research sources
  - No user-generated content flows through the pipeline
  - LLM providers have their own data handling policies

### Backlog Item

PII detection/redaction is tracked as a future enhancement:

- **Item**: Implement PII detection and optional redaction for prompt content
- **Priority**: Medium (Phase 1+)
- **Scope**:
  - Detect common PII patterns (emails, phone numbers, SSNs)
  - Log when PII is detected but not redacted
  - Optional redaction mode for sensitive use cases

See: `docs/backlog/pii-detection.md`

## Verification

To verify compliance with this policy:

1. **Grep for secrets in prompt code**:

   ```bash
   grep -r "API_KEY\|SECRET\|PASSWORD" services/agent-api/src/agents/
   ```

   Should return 0 results in prompt construction code.

2. **Check logs for content sent to LLM**:
   Look for `📤 [agent] Sending to LLM:` log lines during agent runs.

3. **Review prompt templates**:
   Check `prompt_version` table for any hardcoded secrets (should be none).

## References

- US 9.2: Sensitive Data Handling in Prompts
- `services/agent-api/src/lib/llm.js` - LLM abstraction layer
- `services/agent-api/src/agents/*.js` - Agent implementations
