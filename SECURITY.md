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

| Resource                  | Read | Write | Notes                 |
| ------------------------- | ---- | ----- | --------------------- |
| `kb_resource` (published) | ✅   | ❌    | Public resources only |
| `bfsi_industry`           | ✅   | ❌    | Taxonomy data         |
| `bfsi_topic`              | ✅   | ❌    | Taxonomy data         |
| `ref_role`                | ✅   | ❌    | Persona types         |
| `regulation`              | ✅   | ❌    | Regulatory data       |

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
