-- ============================================================================
-- KB-250: Fix triggers that reference dropped status column
-- ============================================================================
-- The text status column was dropped in KB-237, but several triggers still
-- reference NEW.status which causes updates to fail with:
-- "record 'new' has no field 'status'"
-- ============================================================================

-- =============================================================================
-- STEP 1: Drop the deprecated status blocking trigger
-- This trigger was meant to block status text usage but now breaks all updates
-- =============================================================================

DROP TRIGGER IF EXISTS block_deprecated_status_usage ON ingestion_queue;
DROP TRIGGER IF EXISTS block_status_text_write ON ingestion_queue;
DROP FUNCTION IF EXISTS block_deprecated_status_usage() CASCADE;
DROP FUNCTION IF EXISTS block_status_text_write() CASCADE;

-- =============================================================================
-- STEP 2: Drop and recreate the rejection analytics trigger
-- Original used NEW.status = 'rejected', now uses status_code
-- =============================================================================

DROP TRIGGER IF EXISTS rejection_analytics_trigger ON ingestion_queue;
DROP TRIGGER IF EXISTS track_rejections ON ingestion_queue;
DROP FUNCTION IF EXISTS log_rejection_analytics() CASCADE;

-- Recreate using status_code (540 = rejected, 300 = pending_review)
CREATE OR REPLACE FUNCTION log_rejection_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- 540 = rejected, 300 = pending_review
  IF NEW.status_code = 540 AND OLD.status_code = 300 THEN
    INSERT INTO rejection_analytics (
      rejection_reason,
      rejection_category,
      source_slug,
      recorded_at
    ) VALUES (
      NEW.payload->>'rejection_reason',
      COALESCE(NEW.payload->>'rejection_category', 'other'),
      NEW.payload->>'source_slug',
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Only create trigger if rejection_analytics table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rejection_analytics') THEN
    CREATE TRIGGER rejection_analytics_trigger
      AFTER UPDATE ON ingestion_queue
      FOR EACH ROW
      WHEN (NEW.status_code = 540 AND OLD.status_code = 300)
      EXECUTE FUNCTION log_rejection_analytics();
  END IF;
END $$;

-- =============================================================================
-- STEP 3: Drop and recreate auto_process_manual_urls trigger
-- Original used NEW.status = 'pending'/'queued', now uses status_code
-- =============================================================================

DROP TRIGGER IF EXISTS auto_process_manual_submission ON ingestion_queue;
DROP FUNCTION IF EXISTS auto_process_manual_submission();

-- Recreate using status_code (200 = pending_enrichment)
CREATE OR REPLACE FUNCTION auto_process_manual_submission()
RETURNS TRIGGER AS $$
DECLARE
  v_api_url text;
  v_request_id bigint;
BEGIN
  -- Only trigger for manual submissions that are pending enrichment (200)
  IF NEW.status_code = 200 
     AND (NEW.payload->>'manual_submission')::boolean = true THEN
    
    -- Get Agent API URL from Vault
    SELECT decrypted_secret INTO v_api_url 
    FROM vault.decrypted_secrets 
    WHERE name = 'AGENT_API_URL';
    
    -- Skip if no URL configured
    IF v_api_url IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Queue the HTTP request to process this item
    SELECT net.http_post(
      url := v_api_url || '/api/agents/enrich',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Source', 'supabase-trigger'
      ),
      body := jsonb_build_object(
        'id', NEW.id,
        'limit', 1
      )
    ) INTO v_request_id;
    
    RAISE NOTICE 'Queued auto-process for manual submission %, request_id=%', NEW.id, v_request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE TRIGGER auto_process_manual_submission
  AFTER INSERT ON ingestion_queue
  FOR EACH ROW
  WHEN (NEW.status_code = 200 AND (NEW.payload->>'manual_submission')::boolean = true)
  EXECUTE FUNCTION auto_process_manual_submission();

-- =============================================================================
-- STEP 4: Add comment documenting the fix
-- =============================================================================

COMMENT ON FUNCTION log_rejection_analytics() IS 'Logs rejection analytics when items are rejected (KB-250: updated to use status_code)';
COMMENT ON FUNCTION auto_process_manual_submission() IS 'Auto-triggers enrichment for manual URL submissions (KB-250: updated to use status_code)';
