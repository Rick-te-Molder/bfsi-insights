-- Migration: Auto-process manually added URLs
-- Run date: 2025-11-26
-- Purpose: Automatically trigger fetch+enrich when URLs are added via admin panel

-- Enable pg_net extension for async HTTP calls (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger processing via Edge Function
CREATE OR REPLACE FUNCTION trigger_auto_process_url()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_request_id bigint;
BEGIN
  -- Only trigger for manual submissions that are pending
  IF NEW.status = 'pending' 
     AND (NEW.payload->>'manual_submission')::boolean = true THEN
    
    -- Get Supabase URL from settings (set via Dashboard > Settings > Vault)
    SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_URL'
    LIMIT 1;
    
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;
    
    -- Fallback to environment if vault not set
    IF v_supabase_url IS NULL THEN
      v_supabase_url := current_setting('request.headers', true)::json->>'x-forwarded-host';
      IF v_supabase_url IS NOT NULL THEN
        v_supabase_url := 'https://' || v_supabase_url;
      END IF;
    END IF;
    
    -- Make async HTTP request to Edge Function
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/process-url',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object('queueId', NEW.id)
      ) INTO v_request_id;
      
      -- Log the trigger (optional)
      RAISE NOTICE 'Auto-processing triggered for queue item %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_manual_url_added ON ingestion_queue;

-- Create trigger on INSERT to ingestion_queue
CREATE TRIGGER on_manual_url_added
  AFTER INSERT ON ingestion_queue
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_process_url();

COMMENT ON FUNCTION trigger_auto_process_url IS 
  'Automatically triggers fetch+enrich for manually-added URLs by calling process-url Edge Function';

COMMENT ON TRIGGER on_manual_url_added ON ingestion_queue IS 
  'Auto-processes URLs added via admin panel (manual_submission=true, status=pending)';