-- ============================================================================
-- KB-244: Create audit_log table with triggers
-- ============================================================================
-- Creates an append-only audit log for SOC 2 / ISO 27001 compliance.
-- Tracks all changes to key tables for accountability.
-- ============================================================================

-- =============================================================================
-- STEP 1: Create audit_log table
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who performed the action
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  
  -- What action was performed
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject', 'publish')),
  
  -- What entity was affected
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Before/after state for auditing
  old_value JSONB,
  new_value JSONB,
  
  -- Request context (optional, populated when available)
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- Comment
COMMENT ON TABLE audit_log IS 'Append-only audit log for compliance. Tracks all changes to key entities.';

-- =============================================================================
-- STEP 2: RLS policies - audit log is append-only
-- =============================================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (via triggers or server actions)
CREATE POLICY "Service role can insert audit logs"
  ON audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can read their own audit logs
CREATE POLICY "Users can read audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (true);

-- No UPDATE or DELETE policies - audit log is immutable

-- =============================================================================
-- STEP 3: Generic audit trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_value JSONB;
  v_new_value JSONB;
  v_entity_id UUID;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_old_value := NULL;
    v_new_value := to_jsonb(NEW);
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check for special status changes
    IF TG_TABLE_NAME = 'ingestion_queue' THEN
      IF NEW.status_code = 330 AND OLD.status_code != 330 THEN
        v_action := 'approve';
      ELSIF NEW.status_code = 540 AND OLD.status_code != 540 THEN
        v_action := 'reject';
      ELSIF NEW.status_code = 400 AND OLD.status_code != 400 THEN
        v_action := 'publish';
      ELSE
        v_action := 'update';
      END IF;
    ELSE
      v_action := 'update';
    END IF;
    v_old_value := to_jsonb(OLD);
    v_new_value := to_jsonb(NEW);
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_value := to_jsonb(OLD);
    v_new_value := NULL;
    v_entity_id := OLD.id;
  END IF;

  -- Try to get user info from session (may be NULL for system operations)
  BEGIN
    v_user_id := auth.uid();
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
    v_user_email := NULL;
  END;

  -- Insert audit log entry
  INSERT INTO audit_log (
    user_id,
    user_email,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  ) VALUES (
    v_user_id,
    v_user_email,
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_old_value,
    v_new_value
  );

  -- Return appropriate value
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger_func IS 'Generic audit trigger that logs all changes to audit_log table';

-- =============================================================================
-- STEP 4: Attach triggers to key tables
-- =============================================================================

-- Trigger on ingestion_queue (status changes are most important)
DROP TRIGGER IF EXISTS audit_ingestion_queue ON ingestion_queue;
CREATE TRIGGER audit_ingestion_queue
  AFTER UPDATE ON ingestion_queue
  FOR EACH ROW
  WHEN (OLD.status_code IS DISTINCT FROM NEW.status_code)
  EXECUTE FUNCTION audit_trigger_func();

-- Trigger on kb_publication (all operations)
DROP TRIGGER IF EXISTS audit_kb_publication_insert ON kb_publication;
CREATE TRIGGER audit_kb_publication_insert
  AFTER INSERT ON kb_publication
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_kb_publication_update ON kb_publication;
CREATE TRIGGER audit_kb_publication_update
  AFTER UPDATE ON kb_publication
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_kb_publication_delete ON kb_publication;
CREATE TRIGGER audit_kb_publication_delete
  AFTER DELETE ON kb_publication
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

-- Trigger on prompt_version (create and update only - prompts shouldn't be deleted)
DROP TRIGGER IF EXISTS audit_prompt_version_insert ON prompt_version;
CREATE TRIGGER audit_prompt_version_insert
  AFTER INSERT ON prompt_version
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_prompt_version_update ON prompt_version;
CREATE TRIGGER audit_prompt_version_update
  AFTER UPDATE ON prompt_version
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

-- =============================================================================
-- STEP 5: Helper function to query audit log
-- =============================================================================

CREATE OR REPLACE FUNCTION get_entity_audit_history(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_email TEXT,
  action TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.user_email,
    al.action,
    al.old_value,
    al.new_value,
    al.created_at
  FROM audit_log al
  WHERE al.entity_type = p_entity_type
    AND al.entity_id = p_entity_id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMENT ON FUNCTION get_entity_audit_history IS 'Get audit history for a specific entity';

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

/*
AUDIT LOG USAGE:

1. Automatic logging via triggers:
   - ingestion_queue: Logs status changes (approve, reject, publish)
   - kb_publication: Logs all CRUD operations
   - prompt_version: Logs create and update operations

2. Query audit history:
   SELECT * FROM get_entity_audit_history('ingestion_queue', 'uuid-here');
   SELECT * FROM get_entity_audit_history('kb_publication', 'uuid-here');

3. Query recent activity:
   SELECT * FROM audit_log 
   WHERE created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;

4. Query by user:
   SELECT * FROM audit_log 
   WHERE user_email = 'admin@example.com'
   ORDER BY created_at DESC;

NOTE: This table is append-only. No UPDATE or DELETE operations are permitted.
*/
