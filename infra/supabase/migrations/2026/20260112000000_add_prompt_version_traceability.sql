-- Add prompt version traceability to run logs

ALTER TABLE IF EXISTS public.agent_run
  ADD COLUMN IF NOT EXISTS prompt_version_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_run_prompt_version_id_fkey'
  ) THEN
    ALTER TABLE public.agent_run
      ADD CONSTRAINT agent_run_prompt_version_id_fkey
      FOREIGN KEY (prompt_version_id)
      REFERENCES public.prompt_version (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_run_prompt_version_id
  ON public.agent_run (prompt_version_id);

ALTER TABLE IF EXISTS public.agent_run_step
  ADD COLUMN IF NOT EXISTS prompt_version_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_run_step_prompt_version_id_fkey'
  ) THEN
    ALTER TABLE public.agent_run_step
      ADD CONSTRAINT agent_run_step_prompt_version_id_fkey
      FOREIGN KEY (prompt_version_id)
      REFERENCES public.prompt_version (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_run_step_prompt_version_id
  ON public.agent_run_step (prompt_version_id);
