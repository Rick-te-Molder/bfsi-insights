# Prompt Migration Guide

## Version History is Critical

Prompt versions must be preserved for:

- **Learning**: Compare performance across versions
- **Rollback**: Revert to previous version if needed
- **A/B Testing**: Run experiments with different prompts
- **Audit**: Track what changes were made and why

## Correct Migration Pattern

**DO**: Insert new version, update old to non-current

```sql
-- 1. Mark current version as historical
UPDATE prompt_versions
SET is_current = false
WHERE agent_name = 'taxonomy-tagger' AND is_current = true;

-- 2. Insert new version as current
INSERT INTO prompt_versions (agent_name, version, prompt_text, model_id, stage, is_current, notes)
VALUES (
  'taxonomy-tagger',
  'tagger-v2.1',
  $PROMPT$...$PROMPT$,
  'gpt-4o-mini',
  'production',
  true,
  'KB-XXX: Description of changes'
);
```

**DON'T**: Update prompt_text directly (destroys history)

```sql
-- ❌ WRONG - This overwrites history!
UPDATE prompt_versions
SET prompt_text = '...'
WHERE agent_name = 'taxonomy-tagger' AND is_current = true;
```

## Version Naming Convention

- `{agent}-v{major}.{minor}` e.g., `tagger-v2.1`
- Major: Breaking changes, complete rewrites
- Minor: Improvements, bug fixes, clarifications

## Required Fields

| Field         | Description                                       |
| ------------- | ------------------------------------------------- |
| `agent_name`  | Agent identifier (e.g., `taxonomy-tagger`)        |
| `version`     | Version string (e.g., `tagger-v2.1`)              |
| `prompt_text` | The full prompt text                              |
| `model_id`    | Target model (e.g., `gpt-4o-mini`)                |
| `stage`       | `production`, `staging`, or `development`         |
| `is_current`  | `true` for active version, `false` for historical |
| `notes`       | Issue reference + description                     |
