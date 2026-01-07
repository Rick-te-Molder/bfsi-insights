# Threat Analysis (STRIDE)

---

**Version**: 1.0.0  
**Last updated**: 2026-01-07  
**Methodology**: STRIDE (Microsoft Threat Modeling)  
**Scope**: BFSI Insights platform  
**Review cadence**: Annual or after significant architecture changes

---

## 1. System Overview

BFSI Insights is a content curation platform for financial services professionals. It consists of:

- **Public Web App** (Astro) - Content consumption
- **Admin App** (Next.js) - Content management and review
- **Agent API** (Node.js/Express) - Backend processing
- **Database** (Supabase/PostgreSQL) - Data persistence
- **AI Services** (OpenAI) - Content enrichment

### 1.1 Data Flow Diagram

```
[RSS/Sitemaps] → [Discoverer] → [Fetcher] → [Screener] → [Summarizer] → [Tagger]
                                    ↓              ↓            ↓           ↓
                              [Supabase DB] ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
                                    ↓
                              [Admin App] → [Human Review] → [Published Content]
                                    ↓
                              [Public Web]
```

### 1.2 Trust Boundaries

| Boundary | Description               |
| -------- | ------------------------- |
| **TB1**  | Internet ↔ Vercel Edge    |
| **TB2**  | Vercel ↔ Supabase         |
| **TB3**  | Application ↔ OpenAI API  |
| **TB4**  | Admin Users ↔ Admin App   |
| **TB5**  | Public Users ↔ Public Web |

---

## 2. STRIDE Analysis

### 2.1 Spoofing (Identity)

| ID  | Threat                           | Asset         | Likelihood | Impact | Risk       | Mitigation                           |
| --- | -------------------------------- | ------------- | ---------- | ------ | ---------- | ------------------------------------ |
| S1  | Attacker impersonates admin user | Admin App     | Medium     | High   | **High**   | Supabase Auth + MFA                  |
| S2  | Attacker spoofs API requests     | Agent API     | Low        | Medium | **Medium** | API key validation, rate limiting    |
| S3  | Attacker spoofs RSS feed source  | Discoverer    | Low        | Low    | **Low**    | Source allowlist, content validation |
| S4  | Session hijacking                | User sessions | Medium     | High   | **High**   | Secure cookies, short expiry, HTTPS  |

**Controls**:

- [x] Supabase authentication with email/password
- [x] Session tokens with secure flags
- [x] HTTPS everywhere (Vercel enforced)
- [ ] MFA for admin users (planned)
- [x] API key authentication for service calls

### 2.2 Tampering (Data Integrity)

| ID  | Threat                                   | Asset     | Likelihood | Impact   | Risk       | Mitigation                             |
| --- | ---------------------------------------- | --------- | ---------- | -------- | ---------- | -------------------------------------- |
| T1  | SQL injection modifies data              | Database  | Low        | Critical | **High**   | Parameterized queries, Supabase client |
| T2  | XSS modifies page content                | Web apps  | Medium     | Medium   | **Medium** | Output encoding, CSP                   |
| T3  | Man-in-the-middle modifies API responses | All APIs  | Low        | High     | **Medium** | TLS 1.2+, certificate pinning          |
| T4  | Malicious content in RSS feeds           | Pipeline  | Medium     | Low      | **Low**    | Content sanitization                   |
| T5  | Prompt injection via content             | AI agents | Medium     | Medium   | **Medium** | Input sanitization, output validation  |

**Controls**:

- [x] Supabase client uses parameterized queries
- [x] React/Astro auto-escape by default
- [x] TLS enforced on all connections
- [x] Content sanitization in fetcher
- [ ] Prompt injection defenses (partial)

### 2.3 Repudiation (Accountability)

| ID  | Threat                        | Asset              | Likelihood | Impact | Risk       | Mitigation                   |
| --- | ----------------------------- | ------------------ | ---------- | ------ | ---------- | ---------------------------- |
| R1  | User denies approving content | Audit trail        | Medium     | Medium | **Medium** | Action logging with user ID  |
| R2  | Admin denies making changes   | Configuration      | Low        | Medium | **Low**    | Git history, deployment logs |
| R3  | No trace of data access       | PII/sensitive data | Medium     | High   | **High**   | Database audit logging       |

**Controls**:

- [x] Git history for all code changes
- [x] Vercel deployment logs
- [x] `updated_by` columns on key tables
- [ ] Comprehensive audit logging (planned)

### 2.4 Information Disclosure

| ID  | Threat                          | Asset               | Likelihood | Impact   | Risk       | Mitigation                             |
| --- | ------------------------------- | ------------------- | ---------- | -------- | ---------- | -------------------------------------- |
| I1  | Database credentials leaked     | Supabase connection | Low        | Critical | **High**   | Environment variables, secret scanning |
| I2  | API keys exposed in client      | OpenAI key          | Medium     | High     | **High**   | Server-side only, no client exposure   |
| I3  | Error messages reveal internals | Stack traces        | Medium     | Low      | **Low**    | Production error handling              |
| I4  | Content sent to AI providers    | Source content      | High       | Medium   | **Medium** | Data flow documentation, DPA           |
| I5  | Logs contain sensitive data     | Application logs    | Medium     | Medium   | **Medium** | Log sanitization                       |

**Controls**:

- [x] Secrets in environment variables only
- [x] GitHub secret scanning enabled
- [x] API keys server-side only
- [x] Production error boundaries
- [x] AI data flow documented
- [ ] Log sanitization (partial)

### 2.5 Denial of Service

| ID  | Threat                              | Asset      | Likelihood | Impact | Risk       | Mitigation                     |
| --- | ----------------------------------- | ---------- | ---------- | ------ | ---------- | ------------------------------ |
| D1  | DDoS on public website              | Public Web | Medium     | Medium | **Medium** | Vercel edge, rate limiting     |
| D2  | Resource exhaustion via large files | Fetcher    | Medium     | Low    | **Low**    | File size limits, timeouts     |
| D3  | Database connection exhaustion      | Supabase   | Low        | High   | **Medium** | Connection pooling             |
| D4  | AI API quota exhaustion             | OpenAI     | Medium     | Medium | **Medium** | Rate limiting, budget alerts   |
| D5  | Runaway pipeline processing         | Agent API  | Low        | Medium | **Low**    | Queue limits, circuit breakers |

**Controls**:

- [x] Vercel edge DDoS protection
- [x] File size limits in fetcher
- [x] Supabase connection pooling
- [x] OpenAI usage monitoring
- [ ] Circuit breakers (partial)

### 2.6 Elevation of Privilege

| ID  | Threat                          | Asset          | Likelihood | Impact   | Risk     | Mitigation                             |
| --- | ------------------------------- | -------------- | ---------- | -------- | -------- | -------------------------------------- |
| E1  | User escalates to admin         | Admin App      | Low        | Critical | **High** | RLS policies, role checks              |
| E2  | SQL injection gains DB admin    | Database       | Low        | Critical | **High** | Parameterized queries, limited DB user |
| E3  | IDOR accesses other users' data | API endpoints  | Medium     | High     | **High** | RLS, ownership checks                  |
| E4  | JWT manipulation                | Authentication | Low        | Critical | **High** | Supabase managed JWTs                  |

**Controls**:

- [x] Supabase RLS on all tables
- [x] Role-based access in admin app
- [x] Supabase manages JWT signing
- [x] No direct SQL execution
- [ ] Comprehensive IDOR testing (planned)

---

## 3. Risk Summary

### 3.1 Risk Matrix

| Risk Level   | Count | Action                             |
| ------------ | ----- | ---------------------------------- |
| **Critical** | 0     | Immediate remediation              |
| **High**     | 6     | Prioritize in next sprint          |
| **Medium**   | 10    | Address within quarter             |
| **Low**      | 5     | Monitor, address opportunistically |

### 3.2 Top Risks Requiring Attention

| Rank | ID  | Threat                   | Current Status                    |
| ---- | --- | ------------------------ | --------------------------------- |
| 1    | S1  | Admin user impersonation | Mitigated (auth), MFA pending     |
| 2    | T1  | SQL injection            | Mitigated (parameterized queries) |
| 3    | I1  | Credential leakage       | Mitigated (env vars, scanning)    |
| 4    | E1  | Privilege escalation     | Mitigated (RLS)                   |
| 5    | T5  | Prompt injection         | Partial mitigation                |
| 6    | R3  | Missing audit trail      | Planned                           |

---

## 4. Attack Scenarios

### 4.1 Scenario: Compromised Admin Account

**Attack path**:

1. Attacker obtains admin credentials (phishing, credential stuffing)
2. Attacker logs into admin app
3. Attacker approves malicious content or exports data

**Mitigations**:

- Strong password requirements
- MFA (planned)
- Session monitoring
- Action audit trail

### 4.2 Scenario: Prompt Injection via RSS Content

**Attack path**:

1. Attacker controls an RSS feed in our source list
2. Attacker injects malicious instructions in article content
3. AI agent follows injected instructions, potentially:
   - Generating inappropriate summaries
   - Leaking prompt instructions
   - Bypassing content filters

**Mitigations**:

- Content sanitization before AI processing
- Output validation after AI processing
- Human review before publication
- Source allowlist management

### 4.3 Scenario: Supply Chain Attack

**Attack path**:

1. Attacker compromises npm package we depend on
2. Malicious code runs in our build or runtime
3. Attacker exfiltrates secrets or modifies behavior

**Mitigations**:

- npm audit in CI
- Lockfile integrity
- Dependency review for new packages
- GitHub Dependabot alerts

---

## 5. Threat Model Maintenance

### 5.1 Review Triggers

Update this threat model when:

- New components added (services, databases, integrations)
- New data types processed (PII, financial data)
- Architecture changes (new trust boundaries)
- Security incidents occur
- Annual review cycle

### 5.2 Review History

| Date       | Reviewer    | Changes              |
| ---------- | ----------- | -------------------- |
| 2026-01-07 | AI-assisted | Initial threat model |

---

## Appendix A: STRIDE Reference

| Category                   | Question                                | Examples                         |
| -------------------------- | --------------------------------------- | -------------------------------- |
| **Spoofing**               | Can someone pretend to be someone else? | Fake credentials, session hijack |
| **Tampering**              | Can someone modify data they shouldn't? | SQL injection, MITM              |
| **Repudiation**            | Can someone deny their actions?         | Missing audit logs               |
| **Information Disclosure** | Can someone see data they shouldn't?    | Data leaks, verbose errors       |
| **Denial of Service**      | Can someone prevent legitimate access?  | DDoS, resource exhaustion        |
| **Elevation of Privilege** | Can someone gain unauthorized access?   | IDOR, broken access control      |

## Appendix B: Related Documents

- `docs/security/cybersecurity-policy.md` - Security policy
- `docs/security/security-design.md` - Security architecture
- `docs/security/third-party-data-flow.md` - AI provider data handling
