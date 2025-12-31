-- Check which tagger prompt version is currently active
SELECT agent_name, version, notes, created_at
FROM prompt_version
WHERE agent_name = 'tagger'
ORDER BY created_at DESC
LIMIT 5;
