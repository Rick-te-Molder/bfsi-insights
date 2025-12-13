-- KB-219: Clean prompt table schema
--
-- Goals:
-- 1) Use singular table name: prompt_version
-- 2) Use UUID primary key (id) instead of version text PK
-- 3) Preserve existing semantic uniqueness: (agent_name, version)
-- 4) Update rejection_analytics to reference prompt_version via UUID
--
-- IMPORTANT: This is a breaking schema change. All application code must be updated
-- to use prompt_version and UUID ids before this is deployed.

DO $$
BEGIN
  -- 0) Rename table to singular form (if not already renamed)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'prompt_versions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'prompt_version'
  ) THEN
    EXECUTE 'ALTER TABLE public.prompt_versions RENAME TO prompt_version';
  END IF;

  -- 1) Add UUID id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prompt_version' AND column_name = 'id'
  ) THEN
    EXECUTE 'ALTER TABLE public.prompt_version ADD COLUMN id uuid DEFAULT gen_random_uuid()';
  END IF;

  -- 2) Backfill id for existing rows
  EXECUTE 'UPDATE public.prompt_version SET id = gen_random_uuid() WHERE id IS NULL';

  -- 3) Drop old PK on version (if present) and add PK on id
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public' AND t.relname = 'prompt_version' AND c.contype = 'p'
  ) THEN
    EXECUTE 'ALTER TABLE public.prompt_version DROP CONSTRAINT IF EXISTS prompt_versions_pkey';
    EXECUTE 'ALTER TABLE public.prompt_version DROP CONSTRAINT IF EXISTS prompt_version_pkey';
  END IF;

  EXECUTE 'ALTER TABLE public.prompt_version ALTER COLUMN id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.prompt_version ADD CONSTRAINT prompt_version_pkey PRIMARY KEY (id)';

  -- 4) Preserve semantic uniqueness
  EXECUTE 'ALTER TABLE public.prompt_version DROP CONSTRAINT IF EXISTS prompt_versions_version_key';
  EXECUTE 'ALTER TABLE public.prompt_version DROP CONSTRAINT IF EXISTS prompt_version_version_key';
  EXECUTE 'ALTER TABLE public.prompt_version DROP CONSTRAINT IF EXISTS prompt_version_agent_name_version_key';
  EXECUTE 'ALTER TABLE public.prompt_version ADD CONSTRAINT prompt_version_agent_name_version_key UNIQUE (agent_name, version)';

  -- 5) Ensure only one current prompt per agent
  -- (partial unique index: one is_current=true per agent_name)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'prompt_version_one_current_per_agent'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX prompt_version_one_current_per_agent ON public.prompt_version(agent_name) WHERE is_current IS TRUE';
  END IF;

  -- 6) Update rejection_analytics FK from version(text) -> prompt_version.id(uuid)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rejection_analytics' AND column_name = 'prompt_version'
  ) THEN
    -- Add new uuid column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rejection_analytics' AND column_name = 'prompt_version_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.rejection_analytics ADD COLUMN prompt_version_id uuid';
    END IF;

    -- Backfill from version -> id
    EXECUTE '
      UPDATE public.rejection_analytics ra
      SET prompt_version_id = pv.id
      FROM public.prompt_version pv
      WHERE ra.prompt_version_id IS NULL
        AND ra.prompt_version IS NOT NULL
        AND pv.version = ra.prompt_version
    ';

    -- Drop FK on prompt_version (if exists)
    EXECUTE 'ALTER TABLE public.rejection_analytics DROP CONSTRAINT IF EXISTS rejection_analytics_prompt_version_fkey';

    -- Enforce FK on uuid
    EXECUTE 'ALTER TABLE public.rejection_analytics ADD CONSTRAINT rejection_analytics_prompt_version_id_fkey FOREIGN KEY (prompt_version_id) REFERENCES public.prompt_version(id) ON DELETE SET NULL';

    -- Drop old column
    EXECUTE 'ALTER TABLE public.rejection_analytics DROP COLUMN prompt_version';
  END IF;
END $$;
