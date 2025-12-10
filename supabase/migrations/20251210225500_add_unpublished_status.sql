-- Add unpublished status code for items that were live but removed
INSERT INTO status_lookup (code, name, description, category, is_terminal, sort_order)
VALUES (550, 'unpublished', 'Was published but has been removed from the site', 'terminal', true, 550)
ON CONFLICT (code) DO NOTHING;
