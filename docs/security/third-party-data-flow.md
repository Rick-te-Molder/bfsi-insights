# Third-Party AI Data Flow

> **Document Version:** 1.0  
> **Last Updated:** December 2024  
> **KB Reference:** KB-246

This document describes what data is sent to third-party AI providers (OpenAI, Anthropic) for compliance and vendor assessment purposes.

---

## Overview

BFSI Insights uses AI models to process content through an enrichment pipeline. Content flows from discovery through summarization and classification before human review.

### Pipeline Flow

1. **Discoverer** — Finds URLs from RSS feeds and sitemaps _(no AI)_
2. **Fetcher** — Retrieves HTML/PDF content from URLs _(no AI)_
3. **Screener** — Filters for relevance based on content _(OpenAI: gpt-4o-mini)_
4. **Summarizer** — Generates short/medium/long summaries _(OpenAI: gpt-4o)_
5. **Tagger** — Classifies with taxonomy codes _(OpenAI: gpt-4o)_
6. **Thumbnailer** — Captures screenshot of article _(no AI — Playwright)_
7. **Reviewer** — Human approves or rejects _(no AI)_

---

## Agent Data Flow Details

### 1. Screener Agent

**Purpose:** Second-pass filter on full content to confirm relevance.

| Attribute         | Value                                              |
| ----------------- | -------------------------------------------------- |
| **Provider**      | OpenAI                                             |
| **Model**         | `gpt-4o-mini`                                      |
| **Data Sent**     | Title, URL, full article content                   |
| **Data NOT Sent** | User data, internal IDs, previous scores           |
| **Output**        | Pass/fail decision, rejection reason if applicable |

---

### 2. Summarizer Agent

**Purpose:** Generates short, medium, and long summaries.

| Attribute         | Value                                     |
| ----------------- | ----------------------------------------- |
| **Provider**      | OpenAI                                    |
| **Model**         | `gpt-4o`                                  |
| **Data Sent**     | Title, URL, full article content          |
| **Data NOT Sent** | User data, internal IDs                   |
| **Output**        | Three summary lengths (short/medium/long) |

**Note:** This agent uses `gpt-4o` (not mini) for higher quality summaries.

---

### 3. Tagger Agent

**Purpose:** Classifies content with taxonomy codes (industry, topic, geography, etc.).

| Attribute         | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| **Provider**      | OpenAI                                                |
| **Model**         | `gpt-4o`                                              |
| **Data Sent**     | Title, summary, content excerpt, taxonomy definitions |
| **Data NOT Sent** | User data, internal IDs                               |
| **Output**        | Arrays of taxonomy codes with confidence scores       |

**Taxonomy categories sent for reference:**

- Industries (e.g., banking, insurance)
- Topics (e.g., AI, regulation)
- Geographies (e.g., US, EU)
- Regulators (e.g., SEC, FCA)
- Use cases (e.g., fraud detection)

---

## Data Retention & Privacy

### OpenAI API Configuration

| Setting              | Value                                      |
| -------------------- | ------------------------------------------ |
| **API Type**         | OpenAI API (not ChatGPT)                   |
| **Data Retention**   | 30 days for abuse monitoring, then deleted |
| **Training Opt-Out** | API data is NOT used to train models       |
| **Organization ID**  | Configured per environment                 |

**Reference:** [OpenAI API Data Usage Policy](https://openai.com/policies/api-data-usage-policies)

> "OpenAI will not use data submitted by customers via our API to train or improve our models, unless you explicitly opt in."

### What We Do NOT Send

- ❌ User credentials or session data
- ❌ Internal database IDs (UUIDs)
- ❌ Reviewer identities or approval decisions
- ❌ Financial data or PII from articles
- ❌ Source authentication credentials

### PII Considerations

Content processed is **publicly available** from:

- Published research reports
- News articles
- Blog posts
- Regulatory announcements

We do not process:

- User-generated content with PII
- Private communications
- Customer data

---

## Other Third-Party Services

### Anthropic (Claude)

| Attribute       | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| **Usage**       | Alternative model provider (optional)                         |
| **Models**      | `claude-3-5-sonnet`, `claude-3-haiku`                         |
| **Data Sent**   | Same as OpenAI agents                                         |
| **Data Policy** | [Anthropic Privacy Policy](https://www.anthropic.com/privacy) |

### Supabase

| Attribute       | Value                                  |
| --------------- | -------------------------------------- |
| **Usage**       | Database, authentication, storage      |
| **Data Stored** | All content, user accounts, audit logs |
| **Region**      | US (configurable)                      |
| **Encryption**  | At rest and in transit                 |

---

## Logging & Monitoring

### What We Log

Each AI call logs to `enrichment_log` in the item payload:

```json
{
  "agent": "scorer",
  "timestamp": "2024-12-15T01:00:00Z",
  "duration_ms": 1234,
  "model": "gpt-4o-mini",
  "input_tokens": 1500,
  "output_tokens": 200,
  "success": true
}
```

### What We Do NOT Log

- Full prompts sent to AI
- Full responses from AI
- API keys or credentials

---

## Compliance Summary

| Requirement                            | Status |
| -------------------------------------- | ------ |
| Data sent to AI is public content only | ✅     |
| No PII transmitted to AI providers     | ✅     |
| API data not used for model training   | ✅     |
| Audit trail of AI processing           | ✅     |
| Data retention documented              | ✅     |

---

## Contact

For security questions or vendor assessments, contact the project maintainers.
