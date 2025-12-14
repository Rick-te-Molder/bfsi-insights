# Database Documentation

This directory contains auto-generated database schema documentation for AI assistants.

## Files

- `schema.md` - Complete schema reference (auto-generated)
- `README.md` - This file

## Keeping Schema Updated

Run after any schema changes:

```bash
npm run dump:schema
```

## First-Time Setup

Before `dump:schema` works, run this SQL in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION dump_schema_info()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  constraint_type text,
  foreign_table text,
  foreign_column text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    tc.constraint_type::text,
    ccu.table_name::text as foreign_table,
    ccu.column_name::text as foreign_column
  FROM information_schema.columns c
  LEFT JOIN information_schema.key_column_usage kcu
    ON c.table_name = kcu.table_name
    AND c.column_name = kcu.column_name
    AND c.table_schema = kcu.table_schema
  LEFT JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.constraint_type = 'FOREIGN KEY'
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position;
$$;
```

## When to Update

- After running migrations
- After creating/modifying tables in Supabase UI
- Before starting work on database-related features
- Periodically (consider adding to CI)
