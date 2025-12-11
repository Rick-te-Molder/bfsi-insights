-- Migration: Add 'signal' to submitter_channel constraint (KB-214)
-- Signal is the most common channel for article sharing

ALTER TABLE missed_discovery 
DROP CONSTRAINT IF EXISTS missed_discovery_submitter_channel_check;

ALTER TABLE missed_discovery 
ADD CONSTRAINT missed_discovery_submitter_channel_check 
CHECK (submitter_channel IN ('email', 'linkedin', 'meeting', 'signal', 'slack', 'whatsapp', 'other'));
