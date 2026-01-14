-- Create table to track utility agent implementation versions

CREATE TABLE IF NOT EXISTS public.utility_version (
  agent_name text PRIMARY KEY,
  version text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_utility_version_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_utility_version_updated_at ON public.utility_version;

CREATE TRIGGER set_utility_version_updated_at
BEFORE UPDATE ON public.utility_version
FOR EACH ROW
EXECUTE FUNCTION public.set_utility_version_updated_at();

INSERT INTO public.utility_version (agent_name, version)
VALUES ('thumbnail-generator', '1.0.1')
ON CONFLICT (agent_name)
DO UPDATE SET version = EXCLUDED.version;
