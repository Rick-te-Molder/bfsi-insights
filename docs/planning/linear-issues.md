# Linear Issues - Features from README (Not Yet Implemented)

## Backlog Issues

### KB-XXX: Skip filter rejection for manual submissions

**Type:** Bug/Enhancement  
**Priority:** Medium  
**Labels:** agent-api, workflow

**Description:**
Manual submissions from `/admin/add` should bypass the filter agent's rejection logic. When a human explicitly submits a URL, they've already decided it's relevant — the filter should only reject items from automated RSS discovery.

**Acceptance Criteria:**

- [ ] `enrich-item.js` checks `payload.manual_submission` flag
- [ ] If `manual_submission: true`, skip filter rejection (always proceed to summarize)
- [ ] Filter still runs to extract metadata, just doesn't reject
- [ ] Add tests for this behavior

**Reference:** README section 5.2 footnote

---

### KB-148: Enable regulator/regulation filtering

**Type:** Feature  
**Priority:** Medium  
**Labels:** database, taxonomy, frontend  
**Status:** Implemented

**Description:**
The tag agent extracts `regulator_codes` and `regulation_codes` but these are not persisted to the publication or exposed for filtering. Users should be able to filter publications by regulatory body and specific regulations.

**Implementation:**

- `tag.js` extracts codes from `regulator` and `regulation` tables
- Codes stored in queue payload during enrichment
- `approve_from_queue` now inserts regulator/regulation relationships
- Junction tables created: `kb_publication_regulator`, `kb_publication_regulation`
- UI filtering available

**Acceptance Criteria:**

- [x] Create `kb_publication_regulator` junction table
- [x] Create `kb_publication_regulation` junction table
- [x] Update `approve_from_queue` function to insert regulator/regulation relationships
- [x] Update `kb_publication_pretty` view to include `regulators` and `regulations` arrays
- [x] Add regulator/regulation to Publication interface
- [x] Add filter UI for regulator and regulation
- [x] Add regulator/regulation tags to PublicationCard (rose/orange pills with icons)

**Migration:** `20251201230000_add_regulator_regulation_to_publications.sql`

---

### KB-XXX: Taxonomy curation UI during article review

**Type:** Feature  
**Priority:** High  
**Labels:** admin-ui, taxonomy

**Description:**
During article review, the admin should see AI-suggested vendors and organizations extracted by the tag agent. The admin can approve/reject these suggestions, and approved entries are upserted to `ag_vendor` and `bfsi_organization` tables.

**Acceptance Criteria:**

- [ ] Review UI displays extracted `vendor_names` and `organization_names` from payload
- [ ] Admin can toggle which suggestions to accept
- [ ] On article approval, approved names are upserted to taxonomy tables
- [ ] Duplicate detection (don't create if already exists)
- [ ] UI shows existing matches vs new entries

**Reference:** README section 1.4 (taxonomy curation)

---

### KB-XXX: Populate obligation table for regulatory compliance

**Type:** Feature  
**Priority:** Low  
**Labels:** taxonomy, compliance

**Description:**
The `obligation` table should store specific compliance requirements per regulation, completing the Regulator → Regulation → Obligation hierarchy.

**Acceptance Criteria:**

- [ ] Define obligation schema (name, description, regulation_code, category)
- [ ] Seed initial obligations for major regulations (DORA, GDPR, PSD2)
- [ ] Tag agent extracts obligation references from articles
- [ ] Frontend can filter publications by obligation

**Reference:** README section 6.2 (Regulatory Compliance Feature)

---

### KB-XXX: Fix thumbnail agent "No URL provided" error

**Type:** Bug  
**Priority:** Medium  
**Labels:** agent-api, thumbnail

**Description:**
The thumbnail agent fails with "No URL provided" error during processing. The URL from the queue item is not being passed correctly to the thumbnail generator.

**Acceptance Criteria:**

- [ ] Debug `enrich-item.js` thumbnail call
- [ ] Ensure URL is passed from queue item to thumbnail agent
- [ ] Add error handling for missing URL
- [ ] Add test coverage

**Reference:** Render logs from KB-128 deployment

---

### KB-XXX: Fix agent_run logging table schema

**Type:** Bug  
**Priority:** Low  
**Labels:** database, logging

**Description:**
Agent runs fail to log with error: "Could not find the 'publication_id' column of 'agent_run' in the schema cache". The logging table schema needs to be updated or the logging code adjusted.

**Acceptance Criteria:**

- [ ] Check if `publication_id` column exists in `agent_run` table
- [ ] Either add the column or update logging code to use correct column
- [ ] Verify agent runs are logged correctly

**Reference:** Render logs from KB-128 deployment

---

### KB-XXX: More granular taxonomy extraction

**Type:** Enhancement  
**Priority:** Medium  
**Labels:** agent-api, taxonomy

**Description:**
Improve the tag agent to extract more granular taxonomy information from articles, including sub-categories and confidence scores per tag.

**Acceptance Criteria:**

- [ ] Define granular taxonomy requirements
- [ ] Update tag agent prompt
- [ ] Store granular tags in payload
- [ ] Frontend displays granular tags

**Reference:** README section 16 (Roadmap)

---

### KB-XXX: Wider crawling in discovery agent

**Type:** Enhancement  
**Priority:** Low  
**Labels:** agent-api, discovery

**Description:**
Expand the discovery agent to crawl more sources beyond RSS feeds, including sitemap parsing, link following, and social media monitoring.

**Acceptance Criteria:**

- [ ] Define additional source types
- [ ] Implement sitemap parser
- [ ] Add rate limiting and politeness
- [ ] Track crawl history to avoid duplicates

**Reference:** README section 16 (Roadmap)

---

### KB-XXX: Enable regulator/regulation filtering

**Type:** Feature  
**Priority:** Medium  
**Labels:** database, taxonomy, frontend

**Description:**
The tag agent extracts `regulator_codes` and `regulation_codes` but these are not persisted to the publication or exposed for filtering. Users should be able to filter publications by regulatory body and specific regulations.

**Current State:**

- `tag.js` extracts codes from `regulator` and `regulation` tables ✅
- Codes stored in queue payload during enrichment ✅
- `approve_from_queue` does NOT insert regulator/regulation relationships ❌
- No junction tables for publication ↔ regulator/regulation ❌
- No UI filtering available ❌

**Acceptance Criteria:**

- [ ] Create `kb_publication_regulator` junction table
- [ ] Create `kb_publication_regulation` junction table
- [ ] Update `approve_from_queue` function to insert regulator/regulation relationships
- [ ] Update `kb_publication_pretty` view to include `regulators` and `regulations` arrays
- [ ] Add regulator/regulation to Publication interface
- [ ] Add filter UI for regulator and regulation
- [ ] Add regulator/regulation tags to PublicationCard

**Reference:** Tag agent schema, approve function analysis

---

## Embedding & RAG Project

See `docs/linear-project-embeddings.md` for the full project plan.
