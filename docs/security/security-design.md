# Security Design

---

**Version**: 1.0.0  
**Last updated**: 2026-01-07  
**Scope**: BFSI Insights platform security architecture  
**Review cadence**: Annual or after significant changes

---

## 1. Overview

This document describes the security architecture of BFSI Insights, including authentication, authorization, data protection, and security controls at each layer.

## 2. Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Public Web  │  │  Admin App  │  │   API       │              │
│  │   (Astro)   │  │  (Next.js)  │  │  (Express)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                        SECURITY LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    AuthN    │  │    AuthZ    │  │  Validation │              │
│  │ (Supabase)  │  │   (RLS)     │  │  (Zod/etc)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                        APPLICATION                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Services   │  │   Agents    │  │   Queue     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                        DATA                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Supabase   │  │   Storage   │  │    Cache    │              │
│  │ (Postgres)  │  │   (S3)      │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                        EXTERNAL                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   OpenAI    │  │ RSS Sources │  │   Vercel    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Authentication (AuthN)

### 3.1 Identity Provider

**Provider**: Supabase Auth

| Feature            | Implementation                    |
| ------------------ | --------------------------------- |
| User store         | Supabase `auth.users`             |
| Session management | JWT tokens, httpOnly cookies      |
| Password policy    | Min 8 chars, complexity optional  |
| Account recovery   | Email-based reset                 |
| MFA                | Available, not enforced (planned) |

### 3.2 Authentication Flows

**Admin App Login**:

```
User → Login Form → Supabase Auth → JWT → Session Cookie → Authenticated
```

**API Authentication**:

```
Service → API Key Header → Validate Key → Authorized Request
```

**Public Web**:

```
Anonymous → Static Content → No Authentication Required
```

### 3.3 Session Security

| Property      | Value                             |
| ------------- | --------------------------------- |
| Token type    | JWT (Supabase managed)            |
| Token storage | httpOnly cookie                   |
| Token expiry  | 1 hour (access), 7 days (refresh) |
| Cookie flags  | Secure, HttpOnly, SameSite=Lax    |

### 3.4 Service Authentication

| Service                 | Method           | Credential                  |
| ----------------------- | ---------------- | --------------------------- |
| Agent API → Supabase    | Service role key | `SUPABASE_SERVICE_ROLE_KEY` |
| Agent API → OpenAI      | API key          | `OPENAI_API_KEY`            |
| GitHub Actions → Vercel | Token            | `VERCEL_TOKEN`              |

## 4. Authorization (AuthZ)

### 4.1 Authorization Model

**Primary mechanism**: Supabase Row-Level Security (RLS)

```sql
-- Example: Users can only see their own data
CREATE POLICY "users_own_data" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Example: Published content is public
CREATE POLICY "published_public" ON publications
  FOR SELECT USING (status = 'published');

-- Example: Admins can see everything
CREATE POLICY "admin_all" ON publications
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

### 4.2 Role Hierarchy

| Role              | Permissions                                |
| ----------------- | ------------------------------------------ |
| **anonymous**     | Read published content                     |
| **authenticated** | Read published content, manage preferences |
| **reviewer**      | Above + review/approve content             |
| **admin**         | Above + manage users, configure system     |
| **service**       | Backend operations (service role key)      |

### 4.3 Permission Matrix

| Resource          | Anonymous | Authenticated | Reviewer | Admin |
| ----------------- | --------- | ------------- | -------- | ----- |
| Published content | Read      | Read          | Read     | CRUD  |
| Draft content     | -         | -             | Read     | CRUD  |
| User preferences  | -         | Own           | Own      | All   |
| System config     | -         | -             | -        | CRUD  |
| Audit logs        | -         | -             | -        | Read  |

### 4.4 API Authorization

```typescript
// Middleware pattern for protected routes
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: user, error } = await supabase.auth.getUser(token);
  if (error) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
}

// Role check
async function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

## 5. Data Protection

### 5.1 Encryption

| Layer             | Method   | Key Management          |
| ----------------- | -------- | ----------------------- |
| In transit        | TLS 1.2+ | Vercel/Supabase managed |
| At rest (DB)      | AES-256  | Supabase managed        |
| At rest (Storage) | AES-256  | Supabase managed        |
| Backups           | AES-256  | Supabase managed        |

### 5.2 Data Classification

| Classification   | Handling           | Examples            |
| ---------------- | ------------------ | ------------------- |
| **Public**       | No restrictions    | Published summaries |
| **Internal**     | Access controlled  | Prompts, scores     |
| **Confidential** | Encrypted, audited | API keys, user data |

### 5.3 Sensitive Data Handling

**Secrets**:

- Stored in environment variables only
- Never logged, never in error messages
- Rotated every 90 days

**User Data**:

- Minimal collection (email only for auth)
- RLS enforced at database layer
- No client-side storage of sensitive data

## 6. Input Validation

### 6.1 Validation Strategy

```
Input → Sanitize → Validate → Process → Encode → Output
```

### 6.2 Validation Rules

| Input Type         | Validation                      |
| ------------------ | ------------------------------- |
| User input (forms) | Zod schemas, length limits      |
| API parameters     | Type checking, allowlists       |
| File uploads       | Type validation, size limits    |
| URLs               | Protocol allowlist (http/https) |
| HTML content       | DOMPurify sanitization          |

### 6.3 Example Validation

```typescript
import { z } from 'zod';

const PublicationSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url(),
  content: z.string().max(100000),
  tags: z.array(z.string().max(50)).max(20),
});

// Usage
const result = PublicationSchema.safeParse(input);
if (!result.success) {
  throw new ValidationError(result.error);
}
```

## 7. Output Encoding

### 7.1 Context-Aware Encoding

| Context         | Encoding                                    |
| --------------- | ------------------------------------------- |
| HTML body       | HTML entity encoding (React default)        |
| HTML attributes | Attribute encoding                          |
| JavaScript      | JSON.stringify + context escaping           |
| URLs            | encodeURIComponent                          |
| SQL             | Parameterized queries (never string concat) |

### 7.2 Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://*.supabase.co;
  frame-ancestors 'none';
```

## 8. API Security

### 8.1 Rate Limiting

| Endpoint Type     | Limit     | Window |
| ----------------- | --------- | ------ |
| Public API        | 100 req   | 1 min  |
| Authenticated API | 1000 req  | 1 min  |
| Admin API         | 10000 req | 1 min  |
| AI endpoints      | 10 req    | 1 min  |

### 8.2 Request Validation

```typescript
// All API routes should:
// 1. Validate authentication
// 2. Validate authorization
// 3. Validate input
// 4. Log request
// 5. Process
// 6. Sanitize output

app.post(
  '/api/resource',
  authenticate,
  authorize('editor'),
  validateBody(ResourceSchema),
  logRequest,
  async (req, res) => {
    // Process...
  },
);
```

### 8.3 Error Handling

```typescript
// Production error responses
// - Never expose stack traces
// - Never expose internal paths
// - Use generic messages with error codes

{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "code": "E1001"
}

// NOT this:
{
  "error": "TypeError: Cannot read property 'x' of undefined",
  "stack": "at /app/src/services/user.js:42:15..."
}
```

## 9. Logging and Monitoring

### 9.1 Security Events

| Event                    | Logged | Alert                  |
| ------------------------ | ------ | ---------------------- |
| Failed login             | Yes    | After 5 failures       |
| Successful login         | Yes    | No                     |
| Permission denied        | Yes    | After pattern detected |
| Input validation failure | Yes    | No                     |
| Rate limit exceeded      | Yes    | Yes                    |
| Error 500                | Yes    | Yes                    |

### 9.2 Log Format

```json
{
  "timestamp": "2026-01-07T12:00:00Z",
  "level": "warn",
  "event": "auth.login.failed",
  "userId": null,
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "details": {
    "reason": "invalid_password",
    "email": "user@[REDACTED]"
  }
}
```

### 9.3 Log Sanitization

Never log:

- Passwords or tokens
- Full credit card numbers
- API keys
- Personal data beyond necessary identifiers

## 10. Dependency Security

### 10.1 Scanning

| Tool              | Frequency    | Action                     |
| ----------------- | ------------ | -------------------------- |
| npm audit         | Every CI run | Block on High/Critical     |
| GitHub Dependabot | Continuous   | PR for updates             |
| SonarCloud        | Every PR     | Block on security hotspots |

### 10.2 Dependency Policy

- Pin exact versions in lockfile
- Review new dependencies before adding
- Prefer well-maintained packages (recent commits, active issues)
- Check license compatibility

## 11. Infrastructure Security

### 11.1 Vercel (Hosting)

- Edge network with DDoS protection
- Automatic HTTPS
- Environment variable encryption
- Build isolation

### 11.2 Supabase (Database)

- Managed PostgreSQL with encryption
- Row-Level Security enforced
- Connection pooling (pgBouncer)
- Automatic backups

### 11.3 GitHub (Source Control)

- Branch protection on main
- Required reviews
- Secret scanning enabled
- Dependabot enabled

## 12. Security Testing

### 12.1 Automated Testing

| Test Type       | Tool       | Frequency  |
| --------------- | ---------- | ---------- |
| SAST            | SonarCloud | Every PR   |
| Dependency scan | npm audit  | Every PR   |
| Secret scan     | GitHub     | Every push |

### 12.2 Manual Testing (Recommended)

| Test Type        | Frequency   | Scope             |
| ---------------- | ----------- | ----------------- |
| Penetration test | Annual      | Full application  |
| Security review  | Per feature | Auth/data changes |
| RLS audit        | Quarterly   | All policies      |

---

## Appendix A: Security Checklist for PRs

```markdown
## Security Review

### Authentication/Authorization Changes

- [ ] No hardcoded credentials
- [ ] RLS policies updated if needed
- [ ] Role checks in place

### Data Handling

- [ ] Input validated with schema
- [ ] Output encoded appropriately
- [ ] Sensitive data not logged

### Dependencies

- [ ] npm audit clean
- [ ] New deps reviewed and justified

### General

- [ ] No security hotspots in SonarCloud
- [ ] Error messages don't leak internals
```

## Appendix B: Related Documents

- `docs/security/cybersecurity-policy.md` - Policy framework
- `docs/security/threat-analysis.md` - STRIDE threat model
- `docs/engineering/secure-coding.md` - Developer guidelines
