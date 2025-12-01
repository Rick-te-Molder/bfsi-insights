# Linear Project: Embedding-Based Search & RAG

> **Goal:** Build a competitive moat for BFSI Insights through semantic search and AI-powered Q&A using vector embeddings.

## Project Overview

| Field            | Value                                |
| ---------------- | ------------------------------------ |
| **Project Name** | Semantic Search & RAG                |
| **Duration**     | 6-8 weeks                            |
| **Priority**     | High (differentiator)                |
| **Dependencies** | Supabase pgvector, OpenAI embeddings |

## Why This Matters (Moat)

1. **Semantic Search** — Users find content by meaning, not just keywords
2. **Similar Articles** — "More like this" recommendations
3. **AI Q&A** — Ask questions, get answers with citations
4. **Competitive Advantage** — Most BFSI content aggregators have keyword search only

## Architecture

```
Publication → Chunk → Embed → pgvector
                              ↓
User Query → Embed → Similarity Search → Top K chunks
                              ↓
                    LLM + Context → Answer with citations
```

## Issues (Epics → Stories)

### Epic 1: Vector Database Setup

#### KB-XXX: Enable pgvector extension in Supabase

**Type:** Infrastructure  
**Priority:** P0  
**Estimate:** 1 point

**Description:**
Enable the pgvector extension in Supabase and create the embeddings table structure.

**Acceptance Criteria:**

- [ ] Enable pgvector extension in Supabase
- [ ] Create `publication_embeddings` table with vector column
- [ ] Create `publication_chunks` table for chunk storage
- [ ] Add indexes for similarity search (IVFFlat or HNSW)
- [ ] Test basic vector operations

**SQL:**

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE publication_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID REFERENCES kb_publication(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE publication_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID REFERENCES publication_chunks(id) ON DELETE CASCADE,
  embedding vector(1536), -- text-embedding-3-small
  model TEXT DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON publication_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

#### KB-XXX: Create chunking strategy for publications

**Type:** Backend  
**Priority:** P0  
**Estimate:** 2 points

**Description:**
Implement a chunking strategy that splits publication content into optimal chunks for embedding.

**Acceptance Criteria:**

- [ ] Chunk by semantic boundaries (paragraphs, sections)
- [ ] Target ~500 tokens per chunk with overlap
- [ ] Preserve metadata (title, source, date) in each chunk
- [ ] Handle edge cases (very short/long content)
- [ ] Store chunks in `publication_chunks` table

**Chunking Strategy:**

```javascript
// Chunk structure
{
  content: "...",
  metadata: {
    publication_id: "...",
    title: "...",
    source: "...",
    chunk_index: 0,
    total_chunks: 5
  }
}
```

---

### Epic 2: Embedding Pipeline

#### KB-XXX: Create embedding agent

**Type:** Agent  
**Priority:** P0  
**Estimate:** 3 points

**Description:**
Create an embedding agent that generates vector embeddings for publication chunks using OpenAI's text-embedding-3-small model.

**Acceptance Criteria:**

- [ ] New agent: `services/agent-api/src/agents/embed.js`
- [ ] Batch embedding generation (max 2048 inputs per request)
- [ ] Store embeddings in `publication_embeddings` table
- [ ] Track embedding status in `kb_publication` (embedded_at timestamp)
- [ ] CLI command: `node cli.js embed --limit=100`
- [ ] Rate limiting and error handling

**Cost Estimate:**

- text-embedding-3-small: $0.02 per 1M tokens
- ~500 tokens/chunk × 5 chunks/publication = 2,500 tokens/pub
- 1,000 publications = $0.05

---

#### KB-XXX: Integrate embedding into enrichment pipeline

**Type:** Integration  
**Priority:** P1  
**Estimate:** 2 points

**Description:**
Add embedding generation as a step in the enrichment pipeline, after approval.

**Acceptance Criteria:**

- [ ] Embed on approval (not during enrichment — save costs)
- [ ] Update approve function to trigger embedding
- [ ] Add `embedded_at` column to `kb_publication`
- [ ] Backfill existing publications

**Flow:**

```
Approve → Insert to kb_publication → Trigger embedding → embedded_at set
```

---

### Epic 3: Semantic Search API

#### KB-XXX: Create similarity search endpoint

**Type:** API  
**Priority:** P0  
**Estimate:** 3 points

**Description:**
Create an API endpoint that performs semantic similarity search using vector embeddings.

**Acceptance Criteria:**

- [ ] `POST /api/search/semantic` endpoint
- [ ] Accept query string, return top K publications
- [ ] Return relevance scores
- [ ] Support filters (industry, topic, date range)
- [ ] Response includes highlighted matching chunks

**Request:**

```json
{
  "query": "How are banks using AI for fraud detection?",
  "limit": 10,
  "filters": {
    "industry_codes": ["banking"],
    "date_from": "2024-01-01"
  }
}
```

**Response:**

```json
{
  "results": [
    {
      "publication_id": "...",
      "title": "...",
      "score": 0.92,
      "matching_chunk": "...",
      "url": "..."
    }
  ]
}
```

---

#### KB-XXX: Create "similar articles" endpoint

**Type:** API  
**Priority:** P1  
**Estimate:** 2 points

**Description:**
Create an endpoint that returns similar publications given a publication ID.

**Acceptance Criteria:**

- [ ] `GET /api/publications/:id/similar`
- [ ] Return top 5 similar publications
- [ ] Exclude same publication
- [ ] Use average of all chunks for similarity

---

### Epic 4: RAG (Retrieval-Augmented Generation)

#### KB-XXX: Create RAG Q&A endpoint

**Type:** API  
**Priority:** P1  
**Estimate:** 5 points

**Description:**
Create an AI Q&A endpoint that answers questions using publication content as context (RAG).

**Acceptance Criteria:**

- [ ] `POST /api/ask` endpoint
- [ ] Retrieve top K relevant chunks
- [ ] Send to LLM with context
- [ ] Return answer with citations (publication links)
- [ ] Stream response for better UX
- [ ] Rate limiting per user

**Request:**

```json
{
  "question": "What are the main challenges for banks implementing agentic AI?",
  "max_sources": 5
}
```

**Response:**

```json
{
  "answer": "Based on the publications, the main challenges are...",
  "sources": [
    {
      "publication_id": "...",
      "title": "...",
      "url": "...",
      "relevance": 0.94
    }
  ],
  "model": "gpt-4o-mini"
}
```

---

#### KB-XXX: Add citation extraction to RAG responses

**Type:** Enhancement  
**Priority:** P2  
**Estimate:** 2 points

**Description:**
Ensure RAG responses include specific citations with page/paragraph references.

**Acceptance Criteria:**

- [ ] LLM prompt instructs to cite sources by number
- [ ] Response includes footnote-style citations
- [ ] Frontend renders citations as links

---

### Epic 5: Frontend Integration

#### KB-XXX: Add semantic search to frontend

**Type:** Frontend  
**Priority:** P1  
**Estimate:** 3 points

**Description:**
Add a semantic search bar to the publications page that uses vector search.

**Acceptance Criteria:**

- [ ] Search input with "AI-powered search" indicator
- [ ] Debounced search as user types
- [ ] Results show relevance score
- [ ] Fallback to keyword search if embeddings not ready

---

#### KB-XXX: Add "Similar Articles" component

**Type:** Frontend  
**Priority:** P2  
**Estimate:** 2 points

**Description:**
Add a "Similar Articles" section to the publication detail page.

**Acceptance Criteria:**

- [ ] Show 3-5 similar publications
- [ ] Card format with thumbnail
- [ ] Lazy load on scroll

---

#### KB-XXX: Add AI Q&A interface

**Type:** Frontend  
**Priority:** P2  
**Estimate:** 5 points

**Description:**
Create a dedicated AI Q&A page where users can ask questions about BFSI AI topics.

**Acceptance Criteria:**

- [ ] Chat-style interface
- [ ] Streaming responses
- [ ] Clickable citations
- [ ] Conversation history (session-based)
- [ ] Example questions for inspiration

---

## Milestones

| Milestone              | Issues                            | Target |
| ---------------------- | --------------------------------- | ------ |
| **M1: Infrastructure** | pgvector, chunking                | Week 2 |
| **M2: Pipeline**       | Embedding agent, integration      | Week 4 |
| **M3: Search**         | Semantic search, similar articles | Week 5 |
| **M4: RAG**            | Q&A endpoint, citations           | Week 7 |
| **M5: Frontend**       | Search UI, Q&A interface          | Week 8 |

## Cost Estimate

| Item                             | Monthly Cost                  |
| -------------------------------- | ----------------------------- |
| OpenAI Embeddings                | ~$5 (initial), ~$1/mo ongoing |
| OpenAI RAG (GPT-4o-mini)         | ~$10-20/mo (depends on usage) |
| Supabase (Pro plan for pgvector) | $25/mo                        |
| **Total**                        | ~$35-50/mo                    |

## Success Metrics

1. **Search Quality** — User clicks on top 3 results (>60%)
2. **RAG Accuracy** — Answers grounded in sources (spot check)
3. **Engagement** — Time on site increases 20%
4. **Differentiation** — Feature competitors don't have
