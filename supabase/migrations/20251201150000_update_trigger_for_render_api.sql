-- Migration: Update auto-process trigger to call Render-hosted Agent API
-- Issue: KB-128
-- Purpose: Replace Edge Function call with Render API call

-- Update the function to call the Render-hosted Agent API
CREATE OR REPLACE FUNCTION trigger_auto_process_url()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_api_url text;
  v_agent_api_key text;
  v_request_id bigint;
BEGIN
  -- Only trigger for manual submissions that are pending
  IF NEW.status = 'pending' 
     AND (NEW.payload->>'manual_submission')::boolean = true THEN
    
    -- Get Agent API URL from Vault (e.g., https://bfsi-agent-api.onrender.com)
    SELECT decrypted_secret INTO v_agent_api_url
    FROM vault.decrypted_secrets
    WHERE name = 'AGENT_API_URL'
    LIMIT 1;
    
    -- Get Agent API Key from Vault
    SELECT decrypted_secret INTO v_agent_api_key
    FROM vault.decrypted_secrets
    WHERE name = 'AGENT_API_KEY'
    LIMIT 1;
    
    -- Make async HTTP request to Render-hosted Agent API
    IF v_agent_api_url IS NOT NULL AND v_agent_api_key IS NOT NULL THEN
      SELECT net.http_post(
        url := v_agent_api_url || '/api/agents/process-item',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-API-Key', v_agent_api_key
        ),
        body := jsonb_build_object(
          'id', NEW.id::text,
          'includeThumbnail', true
        )
      ) INTO v_request_id;
      
      RAISE NOTICE 'Auto-processing triggered for queue item % (request_id: %)', NEW.id, v_request_id;
    ELSE
      RAISE WARNING 'Agent API URL or Key not configured in Vault. Skipping auto-process.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_auto_process_url IS 
  'Automatically triggers fetch+enrich for manually-added URLs by calling Render-hosted Agent API';

-- =============================================================================
-- MANUAL STEP REQUIRED:
-- =============================================================================
-- After deploying the Agent API to Render, add these secrets to Supabase Vault:
--
-- 1. Go to Supabase Dashboard > Project Settings > Vault
-- 2. Add secret: AGENT_API_URL = https://bfsi-agent-api.onrender.com
-- 3. Add secret: AGENT_API_KEY = (copy from Render environment variables)
--
-- SQL alternative (run in SQL Editor):
-- SELECT vault.create_secret('https://bfsi-agent-api.onrender.com', 'AGENT_API_URL');
-- SELECT vault.create_secret('your-agent-api-key', 'AGENT_API_KEY');
-- =============================================================================
