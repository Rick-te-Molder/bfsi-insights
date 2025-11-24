# Security Documentation

## Overview

This document describes the security architecture, access controls, and operational procedures for the BFSI Insights platform.

## Architecture

**Authentication**: Supabase Auth (email/password)  
**Authorization**: Row Level Security (RLS) + `auth.uid()` checks  
**Admin Functions**: Use `SECURITY DEFINER` with `auth.uid()` audit trail

### Key Principles

1. **Never expose service keys client-side** - All admin operations go via Auth + RLS
2. **Defense in depth** - RLS policies + function-level checks + application logic
3. **Audit trail** - All admin actions logged with `reviewer = auth.uid()`
4. **Least privilege** - Public uses anon key, scripts use service key

---

## 1. Access Control Matrix

### Public Access (Anon Key)

| Resource                     | Read | Write | Notes                    |
| ---------------------------- | ---- | ----- | ------------------------ |
| `kb_publication` (published) | ✅   | ❌    | Public publications only |
| `bfsi_industry`              | ✅   | ❌    | Taxonomy data            |
| `bfsi_topic`                 | ✅   | ❌    | Taxonomy data            |
| `ref_role`                   | ✅   | ❌    | Persona types            |
| `regulation`                 | ✅   | ❌    | Regulatory data          |

### Authenticated Access (User Token)

| Resource                   | Read | Write | Notes                             |
| -------------------------- | ---- | ----- | --------------------------------- |
| `ingestion_queue`          | ✅   | ❌    | Via `ingestion_review_queue` view |
| `approve_from_queue()`     | -    | ✅    | Logs `reviewer = auth.uid()`      |
| `reject_from_queue()`      | -    | ✅    | Logs `reviewer = auth.uid()`      |
| `restore_from_rejection()` | -    | ✅    | Admin function                    |

### Service Role (Scripts Only)

| Resource         | Read | Write | Notes                        |
| ---------------- | ---- | ----- | ---------------------------- |
| All tables       | ✅   | ✅    | **Never expose this key!**   |
| Discovery agent  | ✅   | ✅    | Inserts to `ingestion_queue` |
| Enrichment agent | ✅   | ✅    | Updates `ingestion_queue`    |
| Build scripts    | ✅   | ❌    | Read-only for publishing     |

---

## 2. Environment Variables & Key Locations

### Local Development

**File**: [.env](cci:7://file:///Users/micro/projects/bfsi-insights/.env:0:0-0:0) (gitignored)

```bash
# Public - safe for client-side
PUBLIC_SUPABASE_URL=[https://xxx.supabase.co](https://xxx.supabase.co)
PUBLIC_SUPABASE_ANON_KEY=eyJhb...  # Rate-limited, RLS-protected

# Private - server-side only
SUPABASE_SERVICE_KEY=eyJhb...       # ⚠️ NEVER commit or expose!
OPENAI_API_KEY=sk-xxx
```

### Cloudflare Pages (Production)

**Location**: CF Dashboard → Pages → bfsi-insights → Settings → Environment Variables

```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY  # Client-side safe
```

**⚠️ Never add service key** - CF Pages env vars are bundled into static build!

### GitHub Actions (CI/CD)

**Location**: GitHub → Settings → Secrets and variables → Actions

```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY      # For build/validation
SUPABASE_SERVICE_KEY          # For nightly agents only
OPENAI_API_KEY                # For enrichment agent
```

---

## 3. Key Rotation Procedures

### When to Rotate

- **Anon key**: Rarely needed (RLS-protected, rate-limited)
- **Service key**: If exposed, team member leaves, or annually
- **OpenAI key**: If exposed or suspicious activity detected

### Step-by-Step Rotation

#### Step 1: Generate New Keys in Supabase

1. Go to Supabase Dashboard → Project Settings → API
2. Click "Reset project API keys"
3. Copy new `anon` and `service_role` keys

#### Step 2: Update Local Environment

```bash
cd ~/projects/bfsi-insights
nano .env  # Update PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY
```

#### Step 3: Update Cloudflare Pages

1. Cloudflare Dashboard → Pages → bfsi-insights
2. Settings → Environment Variables
3. Edit `PUBLIC_SUPABASE_ANON_KEY`
4. Save and trigger redeploy

#### Step 4: Update GitHub Secrets

1. GitHub → Settings → Secrets and variables → Actions
2. Update `PUBLIC_SUPABASE_ANON_KEY`
3. Update `SUPABASE_SERVICE_KEY`
4. Re-run latest workflow to verify

#### Step 5: Verify Everything Works

```bash
npm run dev
npm run discover -- --limit=1
npm run enrich -- --limit=1 --dry-run
```

Monitor Supabase Dashboard → Logs for any errors.

---

## 4. Hardening Verification

Run these checks in **Supabase Studio SQL Editor**:

### Verify RLS is Enabled

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('kb_publication', 'ingestion_queue', 'kb_resource_stg');
```

Expected: `rowsecurity = true` for all tables

### Test Authenticated Admin Access

```sql
SELECT * FROM ingestion_review_queue LIMIT 5;
SELECT COUNT(*) FROM kb_publication WHERE status = 'published';
```

Expected: Returns data

### Test Anon/Public Access

```sql
SET ROLE anon;
SELECT * FROM ingestion_queue;
```

Expected: No rows (RLS blocks access)

```sql
SELECT * FROM kb_publication WHERE status = 'published' LIMIT 5;
RESET ROLE;
```

Expected: Returns published publications

---

## 5. Future Extensions

### Multi-Role Authorization

**Current State**: Binary (authenticated vs. anon)  
**Future State**: Role-based (admin, editor, reviewer, viewer)

**Example Implementation** (pseudocode for future reference):

```sql
-- Create roles table
CREATE TABLE app_roles (
  user_id uuid REFERENCES auth.users(id) PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'reviewer', 'viewer')),
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT NOW()
);

-- Helper function
CREATE FUNCTION app.user_role() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT role FROM app_roles WHERE user_id = auth.uid(); $$;

-- Update function with role check
CREATE OR REPLACE FUNCTION approve_from_queue(p_queue_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF app.user_role() NOT IN ('admin', 'editor') THEN
    RAISE EXCEPTION 'Unauthorized: requires admin or editor role';
  END IF;
  -- existing logic
END;
$$;
```

### Webhooks & Background Jobs

**Use Case**: Heavy processing, external API calls, scheduled tasks  
**Recommended**: Cloudflare Workers or Supabase Edge Functions

**Benefits**: Secrets stay server-side, no client exposure

### API Secret Management

**Current**: GitHub Secrets for OpenAI  
**Future**: Supabase Vault for multiple APIs

```sql
SELECT vault.create_secret('anthropic_key', 'sk-ant-xxx');
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anthropic_key';
```

---

## 6. Incident Response

### If Service Key is Exposed

1. **Immediate** (within 5 minutes): Reset keys in Supabase Dashboard
2. **Review** (within 30 minutes): Check Supabase Dashboard → Logs for unauthorized access
3. **Rotate** (within 1 hour): Update local `.env`, CF Pages, GitHub Secrets (see Section 3)
4. **Audit** (within 24 hours): Review recent changes to `kb_publication`, `ingestion_queue`
5. **Document**: Log incident with timeline and lessons learned

### If Suspicious Activity Detected

1. Check Supabase Dashboard → Logs → API calls
2. Look for patterns:
   - High volume from single IP
   - Failed authentication attempts
   - Unexpected table mutations
   - Unusual query patterns
3. If confirmed malicious:
   - Enable rate limiting in Supabase
   - Block IP address in Cloudflare
   - Rotate all keys immediately
   - Review and tighten RLS policies

---

## 7. Best Practices Checklist

- [ ] Service key never committed to Git
- [ ] Service key never in CF Pages env vars
- [ ] All admin functions use `SECURITY DEFINER` + `auth.uid()` audit
- [ ] RLS enabled on all sensitive tables
- [ ] Anon key has rate limiting enabled
- [ ] Keys rotated annually (or after team changes)
- [ ] Monitoring enabled for failed auth attempts
- [ ] Backup admin access documented

---

## Contact & Reporting

For security concerns or to report vulnerabilities, contact the repository owner directly.

**Last updated**: 2025-11-17
