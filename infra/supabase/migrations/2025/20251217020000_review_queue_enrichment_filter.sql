-- KB-266: Review queue filters by run completion
-- Only show items where all enrichment steps succeeded

-- Create a view for the review queue that checks enrichment completion
CREATE OR REPLACE VIEW review_queue_ready AS
SELECT iq.*
FROM ingestion_queue iq
WHERE iq.status_code = 300  -- PENDING_REVIEW
  AND (
    -- Either no current_run_id (legacy items, show them)
    iq.current_run_id IS NULL
    OR
    -- Or all required steps have succeeded
    EXISTS (
      SELECT 1 
      FROM pipeline_step_run psr
      WHERE psr.run_id = iq.current_run_id
        AND psr.step_name IN ('summarize', 'tag', 'thumbnail')
      GROUP BY psr.run_id
      HAVING COUNT(DISTINCT psr.step_name) = 3
         AND bool_and(psr.status = 'success')
    )
  );

-- Grant access to the view
GRANT SELECT ON review_queue_ready TO authenticated;
GRANT SELECT ON review_queue_ready TO service_role;

-- Comment for documentation
COMMENT ON VIEW review_queue_ready IS 'KB-266: Review queue filtered to only show items with all enrichment steps (summarize, tag, thumbnail) completed successfully. Legacy items without current_run_id are included.';

-- Create index to speed up the EXISTS subquery
CREATE INDEX IF NOT EXISTS idx_pipeline_step_run_run_step_status 
ON pipeline_step_run(run_id, step_name, status);
