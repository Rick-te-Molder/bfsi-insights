-- Check geography taxonomy codes
SELECT code, name, parent_code, level
FROM kb_geography
ORDER BY level, parent_code NULLS FIRST, code;
