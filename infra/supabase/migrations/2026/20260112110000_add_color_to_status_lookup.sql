-- Migration: Add color column to status_lookup table
-- This removes hardcoded status colors from the admin app

-- Add color column
ALTER TABLE status_lookup ADD COLUMN IF NOT EXISTS color text;

-- Populate colors based on existing hardcoded values
-- Discovery (100s) - neutral/amber for processing
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-300' WHERE code = 100;
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-300' WHERE code = 110;
UPDATE status_lookup SET color = 'bg-amber-500/20 text-amber-300' WHERE code = 111;
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-300' WHERE code = 112;
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-300' WHERE code = 120;
UPDATE status_lookup SET color = 'bg-amber-500/20 text-amber-300' WHERE code = 121;
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-300' WHERE code = 122;

-- Enrichment (200s) - sky for ready, amber for processing
UPDATE status_lookup SET color = 'bg-sky-500/20 text-sky-300' WHERE code = 200;
UPDATE status_lookup SET color = 'bg-sky-500/20 text-sky-300' WHERE code = 210;
UPDATE status_lookup SET color = 'bg-amber-500/20 text-amber-300' WHERE code = 211;
UPDATE status_lookup SET color = 'bg-sky-500/20 text-sky-300' WHERE code = 212;
UPDATE status_lookup SET color = 'bg-sky-500/20 text-sky-300' WHERE code = 220;
UPDATE status_lookup SET color = 'bg-amber-500/20 text-amber-300' WHERE code = 221;
UPDATE status_lookup SET color = 'bg-sky-500/20 text-sky-300' WHERE code = 222;
UPDATE status_lookup SET color = 'bg-sky-500/20 text-sky-300' WHERE code = 230;
UPDATE status_lookup SET color = 'bg-amber-500/20 text-amber-300' WHERE code = 231;
UPDATE status_lookup SET color = 'bg-sky-500/20 text-sky-300' WHERE code = 232;
UPDATE status_lookup SET color = 'bg-emerald-500/20 text-emerald-300' WHERE code = 240;

-- Review (300s) - purple for pending, amber for active
-- Note: 330 (approved) was removed; approve now goes directly to 400 (published)
UPDATE status_lookup SET color = 'bg-purple-500/20 text-purple-300' WHERE code = 300;
UPDATE status_lookup SET color = 'bg-amber-500/20 text-amber-300' WHERE code = 310;
UPDATE status_lookup SET color = 'bg-amber-500/20 text-amber-300' WHERE code = 320;

-- Published (400s) - green
UPDATE status_lookup SET color = 'bg-green-500/20 text-green-300' WHERE code = 400;
UPDATE status_lookup SET color = 'bg-green-500/20 text-green-300' WHERE code = 410;

-- Terminal (500s) - red for errors, neutral for filtered
UPDATE status_lookup SET color = 'bg-red-500/20 text-red-300' WHERE code = 500;
UPDATE status_lookup SET color = 'bg-red-500/20 text-red-300' WHERE code = 510;
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-400' WHERE code = 520;
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-400' WHERE code = 530;
UPDATE status_lookup SET color = 'bg-red-500/20 text-red-300' WHERE code = 540;
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-400' WHERE code = 550;
UPDATE status_lookup SET color = 'bg-red-500/20 text-red-300' WHERE code = 560;

-- Set default for any status without a color
UPDATE status_lookup SET color = 'bg-neutral-500/20 text-neutral-300' WHERE color IS NULL;

-- Add comment
COMMENT ON COLUMN status_lookup.color IS 'Tailwind CSS classes for status badge styling (bg + text)';
