# Secure Coding Guidelines

---

**Version**: 1.0.0  
**Last updated**: 2026-01-07  
**Audience**: Human developers and AI coding assistants  
**Quality System Control**: C12 (Security-by-default)

---

## 1. Purpose

This document provides practical secure coding guidelines for all contributors (human and synthetic). These rules are designed to prevent common vulnerabilities before they reach code review.

## 2. Golden Rules

1. **Never trust input** — Validate everything from users, APIs, files, environment
2. **Encode output** — Context-aware encoding for HTML, URLs, SQL, etc.
3. **Fail secure** — Deny by default, explicit allow
4. **Least privilege** — Minimum access needed for the task
5. **Defense in depth** — Multiple layers of protection

## 3. Authentication & Sessions

### 3.1 Do

```typescript
// ✅ Use Supabase auth client
const {
  data: { user },
  error,
} = await supabase.auth.getUser();
if (error || !user) {
  return redirect('/login');
}

// ✅ Check authentication on every protected route
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ...
}
```

### 3.2 Don't

```typescript
// ❌ Never implement custom auth
const isValid = password === storedPassword; // NO!

// ❌ Never store passwords
localStorage.setItem('password', password); // NO!

// ❌ Never trust client-side auth state alone
if (clientUser.isAdmin) {
  // NO! - verify server-side
  return adminData;
}
```

## 4. Authorization & Access Control

### 4.1 Do

```typescript
// ✅ Use RLS for data access
// policies are in supabase/migrations/

// ✅ Verify ownership server-side
const { data } = await supabase
  .from('user_preferences')
  .select('*')
  .eq('user_id', authenticatedUserId); // RLS enforces this too

// ✅ Check roles explicitly
if (user.role !== 'admin') {
  return new Response('Forbidden', { status: 403 });
}
```

### 4.2 Don't

```typescript
// ❌ Never rely on hidden fields or client IDs
const userId = request.body.userId; // NO! Use authenticated user

// ❌ Never expose admin functions without role check
export async function deleteAllUsers() {
  // NO! Check role first
  await supabase.from('users').delete();
}

// ❌ Never use string IDs from URL without validation
const { data } = await supabase.from('documents').select('*').eq('id', params.id); // Ensure RLS or ownership check
```

## 5. Input Validation

### 5.1 Do

```typescript
// ✅ Use schema validation (Zod)
import { z } from 'zod';

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(50000),
  tags: z.array(z.string().max(50)).max(10),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = CreatePostSchema.safeParse(body);

  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Invalid input' }), {
      status: 400,
    });
  }

  // Use result.data - it's validated
}

// ✅ Validate file uploads
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Invalid file type');
}
if (file.size > MAX_SIZE) {
  throw new Error('File too large');
}
```

### 5.2 Don't

```typescript
// ❌ Never trust input without validation
const { title, content } = await request.json();
await db.insert({ title, content }); // NO! Validate first

// ❌ Never use eval or Function with user input
eval(userInput); // NEVER!
new Function(userInput)(); // NEVER!

// ❌ Never construct regex from user input
new RegExp(userInput); // Potential ReDoS
```

## 6. Output Encoding

### 6.1 Do

```tsx
// ✅ React auto-escapes by default
return <div>{userContent}</div>; // Safe

// ✅ Use dangerouslySetInnerHTML only with sanitized content
import DOMPurify from 'dompurify';

const sanitized = DOMPurify.sanitize(htmlContent);
return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;

// ✅ Encode URLs properly
const url = `/search?q=${encodeURIComponent(userQuery)}`;

// ✅ Use parameterized queries (Supabase does this)
const { data } = await supabase.from('posts').select('*').eq('author_id', authorId); // Parameterized
```

### 6.2 Don't

```tsx
// ❌ Never insert unsanitized HTML
return <div dangerouslySetInnerHTML={{ __html: userContent }} />; // XSS!

// ❌ Never build SQL strings
const query = `SELECT * FROM users WHERE id = '${userId}'`; // SQL injection!

// ❌ Never build URLs without encoding
const url = `/search?q=${userQuery}`; // Potential injection
```

## 7. SQL & Database

### 7.1 Do

```typescript
// ✅ Always use Supabase client (parameterized)
const { data } = await supabase
  .from('publications')
  .select('*')
  .eq('status', 'published')
  .limit(10);

// ✅ Use RLS policies for access control
// Defined in migrations, not application code

// ✅ Use transactions for multi-step operations
const { data, error } = await supabase.rpc('transfer_funds', {
  from_account: fromId,
  to_account: toId,
  amount: amount,
});
```

### 7.2 Don't

```typescript
// ❌ Never concatenate SQL
await supabase.rpc('raw_query', {
  sql: `SELECT * FROM users WHERE name = '${name}'` // NO!
});

// ❌ Never bypass RLS without explicit need
// service_role key bypasses RLS - use sparingly

// ❌ Never expose database errors to users
catch (error) {
  return new Response(error.message); // May leak schema info
}
```

## 8. Secrets & Configuration

### 8.1 Do

```typescript
// ✅ Use environment variables
const apiKey = process.env.OPENAI_API_KEY;

// ✅ Check for required env vars at startup
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required env var: ${envVar}`);
  }
}

// ✅ Use different keys per environment
// .env.local, .env.production, etc.
```

### 8.2 Don't

```typescript
// ❌ Never hardcode secrets
const API_KEY = 'sk-abc123...'; // NO!

// ❌ Never commit .env files
// .gitignore should include .env*

// ❌ Never log secrets
console.log('API Key:', process.env.API_KEY); // NO!

// ❌ Never expose secrets to client
// Only use NEXT_PUBLIC_ prefix for truly public values
```

## 9. Error Handling

### 9.1 Do

```typescript
// ✅ Use generic error messages in production
catch (error) {
  console.error('Internal error:', error); // Log full error server-side
  return new Response(
    JSON.stringify({ error: 'An error occurred', code: 'E1001' }),
    { status: 500 }
  );
}

// ✅ Handle errors at boundaries
export function ErrorBoundary({ error }) {
  return <div>Something went wrong. Please try again.</div>;
}
```

### 9.2 Don't

```typescript
// ❌ Never expose stack traces
catch (error) {
  return new Response(error.stack); // Leaks internals!
}

// ❌ Never expose database errors
catch (error) {
  return new Response(`Database error: ${error.message}`); // Leaks schema!
}

// ❌ Never ignore errors silently
try {
  await riskyOperation();
} catch (e) {
  // Silent fail - NO!
}
```

## 10. File Handling

### 10.1 Do

```typescript
// ✅ Validate file types by content, not just extension
import fileType from 'file-type';

const type = await fileType.fromBuffer(buffer);
if (!type || !ALLOWED_TYPES.includes(type.mime)) {
  throw new Error('Invalid file type');
}

// ✅ Use secure file paths
import path from 'path';

const safePath = path.join(UPLOAD_DIR, path.basename(filename));

// ✅ Set size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024;
if (file.size > MAX_FILE_SIZE) {
  throw new Error('File too large');
}
```

### 10.2 Don't

```typescript
// ❌ Never trust user-provided paths
const filePath = `/uploads/${userProvidedPath}`; // Path traversal!

// ❌ Never trust file extensions alone
if (filename.endsWith('.jpg')) {
  // Can be spoofed
  // ...
}

// ❌ Never serve user uploads from same origin without care
// Use separate domain or Content-Disposition: attachment
```

## 11. API Security

### 11.1 Do

```typescript
// ✅ Implement rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

// ✅ Validate Content-Type
if (request.headers.get('content-type') !== 'application/json') {
  return new Response('Invalid content type', { status: 415 });
}

// ✅ Use CORS appropriately
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

### 11.2 Don't

```typescript
// ❌ Never allow unlimited requests
// Always implement rate limiting

// ❌ Never use wildcard CORS in production
'Access-Control-Allow-Origin': '*' // Too permissive for sensitive APIs

// ❌ Never expose internal endpoints
app.get('/internal/debug', ...); // Should be behind auth or removed
```

## 12. Third-Party & AI Services

### 12.1 Do

```typescript
// ✅ Sanitize content before sending to AI
const sanitizedContent = sanitizeForAI(userContent);
const response = await openai.chat.completions.create({
  messages: [{ role: 'user', content: sanitizedContent }],
});

// ✅ Validate AI responses before using
const aiResponse = response.choices[0].message.content;
const validated = AIResponseSchema.parse(JSON.parse(aiResponse));

// ✅ Set timeouts for external calls
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000);

await fetch(externalUrl, { signal: controller.signal });
```

### 12.2 Don't

```typescript
// ❌ Never pass unsanitized user input to AI
await openai.chat.completions.create({
  messages: [{ role: 'user', content: userInput }], // Prompt injection risk
});

// ❌ Never trust AI output without validation
const code = aiResponse.content;
eval(code); // NEVER!

// ❌ Never expose API keys to external services
fetch(untrustedUrl, {
  headers: { Authorization: `Bearer ${apiKey}` }, // Key theft!
});
```

## 13. Security Review Triggers

The following changes **require explicit security review**:

| Change Type                        | Review Required             |
| ---------------------------------- | --------------------------- |
| Authentication logic               | Senior + security checklist |
| Authorization/RLS changes          | Senior + RLS audit          |
| Cryptography                       | Senior + security checklist |
| File upload handling               | Security checklist          |
| External API integration           | API security review         |
| Database schema (sensitive tables) | RLS review                  |
| Environment variable changes       | Secrets audit               |

## 14. Quick Reference Checklist

Before submitting any PR:

```markdown
## Security Self-Check

- [ ] No hardcoded secrets
- [ ] Input validated with schemas
- [ ] Output properly encoded
- [ ] SQL uses parameterized queries (Supabase client)
- [ ] Errors don't expose internals
- [ ] Authentication checked on protected routes
- [ ] Authorization verified server-side
- [ ] File uploads validated (type, size)
- [ ] External calls have timeouts
- [ ] Sensitive changes flagged for security review
```

---

## Appendix A: Common Vulnerabilities Reference

| Vulnerability       | Prevention                              |
| ------------------- | --------------------------------------- |
| SQL Injection       | Parameterized queries (Supabase client) |
| XSS                 | Output encoding, CSP, sanitization      |
| CSRF                | SameSite cookies, CSRF tokens           |
| IDOR                | RLS, ownership checks                   |
| Path Traversal      | path.basename(), allowlists             |
| SSRF                | URL allowlists, no user-controlled URLs |
| Credential Stuffing | Rate limiting, MFA                      |
| Session Hijacking   | Secure cookies, short expiry            |

## Appendix B: Related Documents

- `docs/security/cybersecurity-policy.md` - Policy framework
- `docs/security/threat-analysis.md` - STRIDE threat model
- `docs/security/security-design.md` - Security architecture
