# Database Schema Reference

> **Auto-generated** by `npm run dump:schema`  
> **Last updated:** 2025-12-14

This file is the single source of truth for AI assistants to understand the database structure.

## Quick Reference

| Table                              | Rows | Purpose            |
| ---------------------------------- | ---- | ------------------ |
| `ag_capability`                    | 24   | PK: id             |
| `ag_use_case`                      | 16   | PK: id             |
| `ag_use_case_audit`                | 16   | PK: audit_id       |
| `ag_use_case_capability`           | 203  | PK: use_case_id    |
| `ag_vendor`                        | 81   | PK: id             |
| `agent_run`                        | 2152 | PK: id             |
| `agent_run_metric`                 | 115  | PK: run_id         |
| `agent_run_step`                   | 1060 | PK: id             |
| `agent_run_summary`                | 2152 |                    |
| `app_admins`                       | 1    | PK: user_id        |
| `bfsi_entity_type`                 | 24   | PK: id             |
| `bfsi_industry`                    | 53   | PK: id             |
| `bfsi_industry_pretty`             | 53   |                    |
| `bfsi_organization`                | 8    | PK: id             |
| `bfsi_process`                     | 237  | PK: id             |
| `bfsi_process_ref_rules`           | 30   | PK: id             |
| `bfsi_process_reference`           | 161  | PK: id             |
| `bfsi_topic`                       | 5    | PK: id             |
| `classic_papers`                   | 15   | PK: id             |
| `discovery_metrics`                | 0    | PK: id             |
| `eval_golden_set`                  | 24   | PK: id             |
| `eval_result`                      | 0    | PK: id             |
| `eval_run`                         | 6    | PK: id             |
| `ingestion_queue`                  | 2699 | PK: id             |
| `ingestion_queue_with_status`      | 2699 |                    |
| `ingestion_review_queue`           | 0    |                    |
| `kb_audience`                      | 4    | PK: id             |
| `kb_category`                      | 9    | PK: slug           |
| `kb_channel`                       | 7    | PK: slug           |
| `kb_geography`                     | 30   | PK: id             |
| `kb_publication`                   | 138  | PK: id             |
| `kb_publication_ag_vendor`         | 0    | PK: publication_id |
| `kb_publication_bfsi_industry`     | 176  | PK: publication_id |
| `kb_publication_bfsi_organization` | 0    | PK: publication_id |
| `kb_publication_bfsi_process`      | 7    | PK: process_code   |
| `kb_publication_bfsi_topic`        | 122  | PK: publication_id |
| `kb_publication_obligation`        | 0    | PK: publication_id |
| `kb_publication_pretty`            | 138  |                    |
| `kb_publication_regulation`        | 0    | PK: publication_id |
| `kb_publication_regulator`         | 8    | PK: publication_id |
| `kb_publication_standard`          | 0    | PK: resource_id    |
| `kb_publication_type`              | 10   | PK: code           |
| `kb_rejection_pattern`             | 7    | PK: id             |
| `kb_source`                        | 83   | PK: slug           |
| `missed_discovery`                 | 1    | PK: id             |
| `obligation`                       | 18   | PK: id             |
| `obligation_pretty`                | 18   |                    |
| `pending_entity_proposals`         | 0    |                    |
| `process_taxonomy_apqc`            | 54   | PK: id             |
| `process_taxonomy_basel`           | 19   | PK: id             |
| `process_taxonomy_bian`            | 24   | PK: id             |
| `process_taxonomy_fatf`            | 17   | PK: id             |
| `process_taxonomy_gics`            | 0    | PK: id             |
| `process_taxonomy_iso20022`        | 13   | PK: id             |
| `process_taxonomy_nace`            | 0    | PK: id             |
| `process_taxonomy_naics`           | 0    | PK: id             |
| `process_taxonomy_sepa`            | 1    | PK: id             |
| `process_taxonomy_solvencyii`      | 10   | PK: id             |
| `prompt_ab_test`                   | 0    | PK: id             |
| `prompt_ab_test_item`              | 0    | PK: id             |
| `prompt_version`                   | 11   | PK: id             |
| `proposed_entity`                  | 0    | PK: id             |
| `publication_edit_history`         | 0    |                    |
| `ref_filter_config`                | 8    | PK: column_name    |
| `regulation`                       | 18   | PK: id             |
| `regulation_obligations_pretty`    | ?    |                    |
| `regulation_pretty`                | ?    |                    |
| `regulator`                        | 22   | PK: id             |
| `regulator_pretty`                 | ?    |                    |
| `rejection_analytics`              | 0    | PK: id             |
| `rls_status`                       | 69   |                    |
| `standard`                         | 0    | PK: id             |
| `standard_setter`                  | 10   | PK: id             |
| `status_history`                   | 2361 | PK: id             |
| `status_lookup`                    | 30   | PK: code           |
| `tables_columns`                   | 69   |                    |
| `taxonomy_bian`                    | 60   | PK: id             |
| `taxonomy_bian_pretty`             | 60   |                    |
| `taxonomy_config`                  | 12   | PK: id             |
| `taxonomy_gics`                    | 14   | PK: id             |
| `taxonomy_nace`                    | 35   | PK: id             |
| `taxonomy_naics`                   | 20   | PK: id             |
| `v_queue_daily_stats`              | 0    |                    |
| `v_queue_health`                   | 4    |                    |
| `v_queue_pending_by_source`        | 0    |                    |
| `views`                            | 15   |                    |
| `writing_rules`                    | 14   | PK: id             |

---

## Table Details

### `ag_capability`

**Rows:** 24

| Column            | Type                     | Nullable | Default        | Constraints |
| ----------------- | ------------------------ | -------- | -------------- | ----------- |
| `id`              | bigint                   | NO       |                | PK          |
| `code`            | text                     | NO       |                | UNIQUE      |
| `name`            | text                     | NO       |                | UNIQUE      |
| `description`     | text                     | YES      |                |             |
| `category`        | text                     | YES      |                |             |
| `tags`            | ARRAY                    | YES      |                |             |
| `ag_use_case_ids` | ARRAY                    | YES      | '{}'::bigint[] |             |
| `created_at`      | timestamp with time zone | YES      | now()          |             |
| `updated_at`      | timestamp with time zone | YES      | now()          |             |

### `ag_use_case`

**Rows:** 16

| Column                | Type                     | Nullable | Default       | Constraints            |
| --------------------- | ------------------------ | -------- | ------------- | ---------------------- |
| `id`                  | bigint                   | NO       |               | PK                     |
| `created_at`          | timestamp with time zone | NO       | now()         |                        |
| `name`                | text                     | NO       |               |                        |
| `persona`             | text                     | YES      |               |                        |
| `problem_need`        | text                     | YES      |               |                        |
| `agent_action`        | text                     | YES      |               |                        |
| `outcome_deliverable` | text                     | YES      |               |                        |
| `risk_control_notes`  | text                     | YES      |               |                        |
| `status`              | text                     | YES      | 'draft'::text |                        |
| `updated_at`          | timestamp with time zone | YES      | now()         |                        |
| `tags`                | ARRAY                    | YES      |               |                        |
| `bfsi_process_code`   | text                     | YES      |               | FK → bfsi_process.code |
| `reach`               | integer                  | YES      |               |                        |
| `impact`              | integer                  | YES      |               |                        |
| `confidence`          | integer                  | YES      |               |                        |
| `ease`                | integer                  | YES      |               |                        |
| `rice_score`          | integer                  | YES      |               |                        |
| `name_ci`             | text                     | YES      |               | UNIQUE                 |
| `code`                | text                     | NO       |               | UNIQUE                 |

### `ag_use_case_audit`

**Rows:** 16

| Column           | Type                     | Nullable | Default                           | Constraints |
| ---------------- | ------------------------ | -------- | --------------------------------- | ----------- |
| `audit_id`       | bigint                   | NO       | nextval('ag_use_case_score_aud... | PK          |
| `id`             | integer                  | NO       |                                   |             |
| `changed_at`     | timestamp with time zone | NO       | now()                             |             |
| `changed_by`     | text                     | NO       | CURRENT_USER                      |             |
| `old_reach`      | integer                  | YES      |                                   |             |
| `old_impact`     | integer                  | YES      |                                   |             |
| `old_confidence` | integer                  | YES      |                                   |             |
| `old_ease`       | integer                  | YES      |                                   |             |
| `old_rice`       | integer                  | YES      |                                   |             |
| `new_reach`      | integer                  | YES      |                                   |             |
| `new_impact`     | integer                  | YES      |                                   |             |
| `new_confidence` | integer                  | YES      |                                   |             |
| `new_ease`       | integer                  | YES      |                                   |             |
| `new_rice`       | integer                  | YES      |                                   |             |

### `ag_use_case_capability`

**Rows:** 203

| Column          | Type                     | Nullable | Default          | Constraints           |
| --------------- | ------------------------ | -------- | ---------------- | --------------------- |
| `use_case_id`   | bigint                   | NO       |                  | PK                    |
| `use_case_id`   | bigint                   | NO       |                  | FK → ag_use_case.id   |
| `capability_id` | bigint                   | NO       |                  | PK                    |
| `capability_id` | bigint                   | NO       |                  | FK → ag_capability.id |
| `relation_type` | text                     | NO       | 'required'::text |                       |
| `weight`        | numeric                  | YES      |                  |                       |
| `rationale`     | text                     | YES      |                  |                       |
| `created_at`    | timestamp with time zone | NO       | now()            |                       |
| `updated_at`    | timestamp with time zone | NO       | now()            |                       |

### `ag_vendor`

**Rows:** 81

| Column            | Type                     | Nullable | Default           | Constraints |
| ----------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`              | uuid                     | NO       | gen_random_uuid() | PK          |
| `created_at`      | timestamp with time zone | NO       | now()             |             |
| `name`            | text                     | NO       |                   |             |
| `updated_at`      | timestamp with time zone | NO       | now()             |             |
| `created_by`      | uuid                     | YES      | auth.uid()        |             |
| `aliases`         | ARRAY                    | YES      |                   |             |
| `website`         | text                     | YES      |                   |             |
| `hq_country`      | text                     | YES      |                   |             |
| `regions_served`  | ARRAY                    | YES      |                   |             |
| `founded_year`    | integer                  | YES      |                   |             |
| `ownership_type`  | text                     | YES      |                   |             |
| `headcount_range` | text                     | YES      |                   |             |
| `funding_stage`   | text                     | YES      |                   |             |
| `parent_entity`   | text                     | YES      |                   |             |
| `deployment`      | ARRAY                    | YES      |                   |             |
| `certifications`  | ARRAY                    | YES      |                   |             |
| `data_coverage`   | jsonb                    | YES      |                   |             |
| `pricing_model`   | text                     | YES      |                   |             |
| `notes`           | text                     | YES      |                   |             |
| `name_lc`         | text                     | YES      |                   |             |
| `name_norm`       | text                     | YES      |                   |             |
| `category`        | text                     | YES      | 'Other'::text     |             |

### `agent_run`

**Rows:** 2152

| Column           | Type                     | Nullable | Default           | Constraints                |
| ---------------- | ------------------------ | -------- | ----------------- | -------------------------- |
| `id`             | uuid                     | NO       | gen_random_uuid() | PK                         |
| `queue_id`       | uuid                     | YES      |                   | FK → ingestion_queue.id    |
| `stg_id`         | uuid                     | YES      |                   | FK → kb_publication_stg.id |
| `agent_name`     | text                     | NO       |                   |                            |
| `stage`          | text                     | YES      |                   |                            |
| `model_id`       | text                     | YES      |                   |                            |
| `prompt_version` | text                     | YES      |                   |                            |
| `started_at`     | timestamp with time zone | NO       | now()             |                            |
| `finished_at`    | timestamp with time zone | YES      |                   |                            |
| `status`         | text                     | NO       | 'running'::text   |                            |
| `error_message`  | text                     | YES      |                   |                            |
| `agent_metadata` | jsonb                    | YES      |                   |                            |
| `publication_id` | uuid                     | YES      |                   | FK → kb_publication.id     |

### `agent_run_metric`

**Rows:** 115

| Column         | Type                     | Nullable | Default | Constraints       |
| -------------- | ------------------------ | -------- | ------- | ----------------- |
| `run_id`       | uuid                     | NO       |         | FK → agent_run.id |
| `run_id`       | uuid                     | NO       |         | PK                |
| `metric_name`  | text                     | NO       |         | PK                |
| `metric_value` | numeric                  | NO       |         |                   |
| `created_at`   | timestamp with time zone | NO       | now()   |                   |

### `agent_run_step`

**Rows:** 1060

| Column        | Type                     | Nullable | Default           | Constraints       |
| ------------- | ------------------------ | -------- | ----------------- | ----------------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK                |
| `run_id`      | uuid                     | NO       |                   | FK → agent_run.id |
| `step_order`  | integer                  | NO       |                   |                   |
| `step_type`   | text                     | YES      |                   |                   |
| `input_size`  | integer                  | YES      |                   |                   |
| `output_size` | integer                  | YES      |                   |                   |
| `started_at`  | timestamp with time zone | NO       | now()             |                   |
| `finished_at` | timestamp with time zone | YES      |                   |                   |
| `status`      | text                     | NO       | 'running'::text   |                   |
| `details`     | jsonb                    | YES      |                   |                   |

### `agent_run_summary`

**Rows:** 2152

| Column         | Type                     | Nullable | Default | Constraints |
| -------------- | ------------------------ | -------- | ------- | ----------- |
| `run_id`       | uuid                     | YES      |         |             |
| `agent_name`   | text                     | YES      |         |             |
| `stage`        | text                     | YES      |         |             |
| `status`       | text                     | YES      |         |             |
| `started_at`   | timestamp with time zone | YES      |         |             |
| `finished_at`  | timestamp with time zone | YES      |         |             |
| `duration_min` | numeric                  | YES      |         |             |
| `items_found`  | numeric                  | YES      |         |             |
| `processed`    | numeric                  | YES      |         |             |
| `success`      | numeric                  | YES      |         |             |
| `failed`       | numeric                  | YES      |         |             |

### `app_admins`

**Rows:** 1

| Column       | Type                     | Nullable | Default | Constraints    |
| ------------ | ------------------------ | -------- | ------- | -------------- |
| `user_id`    | uuid                     | NO       |         | FK → null.null |
| `user_id`    | uuid                     | NO       |         | PK             |
| `created_at` | timestamp with time zone | YES      | now()   |                |

### `bfsi_entity_type`

**Rows:** 24

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `code`        | text                     | NO       |                   | UNIQUE      |
| `name`        | text                     | NO       |                   |             |
| `category`    | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | NO       | now()             |             |
| `updated_at`  | timestamp with time zone | NO       | now()             |             |

### `bfsi_industry`

**Rows:** 53

| Column        | Type                     | Nullable | Default           | Constraints             |
| ------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK                      |
| `code`        | text                     | NO       |                   | UNIQUE                  |
| `name`        | text                     | NO       |                   |                         |
| `level`       | integer                  | NO       |                   |                         |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `sort_order`  | integer                  | YES      | 0                 |                         |
| `description` | text                     | YES      |                   |                         |
| `created_at`  | timestamp with time zone | YES      | now()             |                         |
| `updated_at`  | timestamp with time zone | YES      | now()             |                         |

### `bfsi_industry_pretty`

**Rows:** 53

| Column             | Type                     | Nullable | Default | Constraints |
| ------------------ | ------------------------ | -------- | ------- | ----------- |
| `id`               | uuid                     | YES      |         |             |
| `code`             | text                     | YES      |         |             |
| `name`             | text                     | YES      |         |             |
| `level`            | integer                  | YES      |         |             |
| `parent_code`      | text                     | YES      |         |             |
| `sort_order`       | integer                  | YES      |         |             |
| `description`      | text                     | YES      |         |             |
| `created_at`       | timestamp with time zone | YES      |         |             |
| `updated_at`       | timestamp with time zone | YES      |         |             |
| `parent_name`      | text                     | YES      |         |             |
| `parent_code_full` | text                     | YES      |         |             |
| `root_code`        | text                     | YES      |         |             |
| `root_name`        | text                     | YES      |         |             |
| `path`             | text                     | YES      |         |             |
| `full_path`        | text                     | YES      |         |             |

### `bfsi_organization`

**Rows:** 8

| Column                    | Type                     | Nullable | Default           | Constraints |
| ------------------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`                      | uuid                     | NO       | gen_random_uuid() | PK          |
| `organization_name`       | text                     | NO       |                   | UNIQUE      |
| `description`             | text                     | YES      |                   |             |
| `entity_type`             | text                     | YES      |                   |             |
| `headquarters_country`    | text                     | YES      |                   |             |
| `involvement_in_payments` | boolean                  | YES      |                   |             |
| `created_at`              | timestamp with time zone | NO       | now()             |             |

### `bfsi_process`

**Rows:** 237

| Column        | Type                     | Nullable | Default           | Constraints             |
| ------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK                      |
| `code`        | text                     | NO       |                   | UNIQUE                  |
| `name`        | text                     | NO       |                   |                         |
| `level`       | integer                  | NO       |                   |                         |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `sort_order`  | integer                  | YES      | 0                 |                         |
| `description` | text                     | YES      |                   |                         |
| `created_at`  | timestamp with time zone | YES      | now()             |                         |
| `updated_at`  | timestamp with time zone | YES      | now()             |                         |

### `bfsi_process_ref_rules`

**Rows:** 30

| Column    | Type   | Nullable | Default | Constraints |
| --------- | ------ | -------- | ------- | ----------- |
| `pattern` | text   | NO       |         |             |
| `scheme`  | text   | NO       |         |             |
| `code`    | text   | NO       |         |             |
| `note`    | text   | YES      |         |             |
| `id`      | bigint | NO       |         | PK          |

### `bfsi_process_reference`

**Rows:** 161

| Column        | Type    | Nullable | Default                           | Constraints |
| ------------- | ------- | -------- | --------------------------------- | ----------- |
| `id`          | integer | NO       | nextval('bfsi_process_referenc... | PK          |
| `taxonomy_id` | text    | NO       |                                   | UNIQUE      |
| `scheme`      | text    | NO       |                                   | UNIQUE      |
| `code`        | text    | NO       |                                   | UNIQUE      |
| `description` | text    | YES      |                                   |             |

### `bfsi_topic`

**Rows:** 5

| Column        | Type                     | Nullable | Default           | Constraints             |
| ------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK                      |
| `code`        | text                     | NO       |                   | UNIQUE                  |
| `name`        | text                     | NO       |                   |                         |
| `level`       | integer                  | NO       |                   |                         |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_topic.code    |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `sort_order`  | integer                  | YES      | 0                 |                         |
| `description` | text                     | YES      |                   |                         |
| `created_at`  | timestamp with time zone | YES      | now()             |                         |
| `updated_at`  | timestamp with time zone | YES      | now()             |                         |

### `classic_papers`

**Rows:** 15

| Column                | Type                     | Nullable | Default           | Constraints            |
| --------------------- | ------------------------ | -------- | ----------------- | ---------------------- |
| `id`                  | uuid                     | NO       | gen_random_uuid() | PK                     |
| `title`               | text                     | NO       |                   |                        |
| `authors`             | ARRAY                    | YES      |                   |                        |
| `year`                | integer                  | YES      |                   |                        |
| `doi`                 | text                     | YES      |                   |                        |
| `arxiv_id`            | text                     | YES      |                   |                        |
| `semantic_scholar_id` | text                     | YES      |                   |                        |
| `category`            | text                     | NO       |                   |                        |
| `subcategory`         | text                     | YES      |                   |                        |
| `significance`        | text                     | NO       |                   |                        |
| `executive_relevance` | text                     | YES      |                   |                        |
| `discovered`          | boolean                  | YES      | false             |                        |
| `discovered_at`       | timestamp with time zone | YES      |                   |                        |
| `publication_id`      | uuid                     | YES      |                   | FK → kb_publication.id |
| `citation_count`      | integer                  | YES      |                   |                        |
| `created_at`          | timestamp with time zone | YES      | now()             |                        |
| `updated_at`          | timestamp with time zone | YES      | now()             |                        |

### `discovery_metrics`

**Rows:** 0

| Column                | Type                     | Nullable | Default           | Constraints         |
| --------------------- | ------------------------ | -------- | ----------------- | ------------------- |
| `id`                  | uuid                     | NO       | gen_random_uuid() | PK                  |
| `run_date`            | date                     | NO       | CURRENT_DATE      |                     |
| `source_slug`         | text                     | YES      |                   | FK → kb_source.slug |
| `candidates_found`    | integer                  | YES      | 0                 |                     |
| `passed_relevance`    | integer                  | YES      | 0                 |                     |
| `auto_skipped`        | integer                  | YES      | 0                 |                     |
| `queued`              | integer                  | YES      | 0                 |                     |
| `avg_relevance_score` | numeric                  | YES      |                   |                     |
| `min_relevance_score` | numeric                  | YES      |                   |                     |
| `max_relevance_score` | numeric                  | YES      |                   |                     |
| `total_tokens_used`   | integer                  | YES      | 0                 |                     |
| `estimated_cost_usd`  | numeric                  | YES      |                   |                     |
| `created_at`          | timestamp with time zone | YES      | now()             |                     |

### `eval_golden_set`

**Rows:** 24

| Column            | Type                     | Nullable | Default           | Constraints |
| ----------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`              | uuid                     | NO       | gen_random_uuid() | PK          |
| `agent_name`      | text                     | NO       |                   |             |
| `name`            | text                     | NO       |                   |             |
| `description`     | text                     | YES      |                   |             |
| `input`           | jsonb                    | NO       |                   |             |
| `expected_output` | jsonb                    | NO       |                   |             |
| `created_by`      | text                     | YES      |                   |             |
| `created_at`      | timestamp with time zone | YES      | now()             |             |
| `updated_at`      | timestamp with time zone | YES      | now()             |             |

### `eval_result`

**Rows:** 0

| Column            | Type                     | Nullable | Default           | Constraints      |
| ----------------- | ------------------------ | -------- | ----------------- | ---------------- |
| `id`              | uuid                     | NO       | gen_random_uuid() | PK               |
| `run_id`          | uuid                     | NO       |                   | FK → eval_run.id |
| `input`           | jsonb                    | NO       |                   |                  |
| `expected_output` | jsonb                    | YES      |                   |                  |
| `actual_output`   | jsonb                    | YES      |                   |                  |
| `passed`          | boolean                  | YES      |                   |                  |
| `score`           | numeric                  | YES      |                   |                  |
| `judge_reasoning` | text                     | YES      |                   |                  |
| `judge_model`     | text                     | YES      |                   |                  |
| `output_a`        | jsonb                    | YES      |                   |                  |
| `output_b`        | jsonb                    | YES      |                   |                  |
| `winner`          | text                     | YES      |                   |                  |
| `created_at`      | timestamp with time zone | YES      | now()             |                  |

### `eval_run`

**Rows:** 6

| Column                   | Type                     | Nullable | Default           | Constraints             |
| ------------------------ | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`                     | uuid                     | NO       | gen_random_uuid() | PK                      |
| `agent_name`             | text                     | NO       |                   |                         |
| `prompt_version`         | text                     | NO       |                   |                         |
| `eval_type`              | text                     | NO       |                   |                         |
| `golden_set_id`          | uuid                     | YES      |                   | FK → eval_golden_set.id |
| `compare_prompt_version` | text                     | YES      |                   |                         |
| `status`                 | text                     | YES      | 'running'::text   |                         |
| `total_examples`         | integer                  | YES      |                   |                         |
| `passed`                 | integer                  | YES      |                   |                         |
| `failed`                 | integer                  | YES      |                   |                         |
| `score`                  | numeric                  | YES      |                   |                         |
| `results`                | jsonb                    | YES      |                   |                         |
| `started_at`             | timestamp with time zone | YES      | now()             |                         |
| `finished_at`            | timestamp with time zone | YES      |                   |                         |
| `duration_ms`            | integer                  | YES      |                   |                         |

### `ingestion_queue`

**Rows:** 2699

| Column                   | Type                     | Nullable | Default            | Constraints |
| ------------------------ | ------------------------ | -------- | ------------------ | ----------- |
| `id`                     | uuid                     | NO       | gen_random_uuid()  | PK          |
| `url`                    | text                     | NO       |                    |             |
| `url_norm`               | text                     | YES      |                    |             |
| `content_hash`           | text                     | YES      |                    |             |
| `status`                 | text                     | YES      | 'pending'::text    |             |
| `content_type`           | text                     | YES      | 'resource'::text   |             |
| `payload`                | jsonb                    | NO       |                    |             |
| `payload_schema_version` | integer                  | NO       | 1                  |             |
| `raw_ref`                | text                     | YES      |                    |             |
| `thumb_ref`              | text                     | YES      |                    |             |
| `etag`                   | text                     | YES      |                    |             |
| `last_modified`          | timestamp with time zone | YES      |                    |             |
| `discovered_at`          | timestamp with time zone | YES      | now()              |             |
| `fetched_at`             | timestamp with time zone | YES      |                    |             |
| `reviewed_at`            | timestamp with time zone | YES      |                    |             |
| `reviewer`               | uuid                     | YES      |                    |             |
| `rejection_reason`       | text                     | YES      |                    |             |
| `prompt_version`         | text                     | YES      |                    |             |
| `model_id`               | text                     | YES      |                    |             |
| `agent_metadata`         | jsonb                    | YES      |                    |             |
| `stg_id`                 | uuid                     | YES      |                    |             |
| `approved_at`            | timestamp with time zone | YES      |                    |             |
| `relevance_score`        | numeric                  | YES      |                    |             |
| `executive_summary`      | text                     | YES      |                    |             |
| `skip_reason`            | text                     | YES      |                    |             |
| `status_code`            | smallint                 | NO       | 200                |             |
| `entry_type`             | text                     | YES      | 'discovered'::text |             |

### `ingestion_queue_with_status`

**Rows:** 2699

| Column                   | Type                     | Nullable | Default | Constraints |
| ------------------------ | ------------------------ | -------- | ------- | ----------- |
| `id`                     | uuid                     | YES      |         |             |
| `url`                    | text                     | YES      |         |             |
| `url_norm`               | text                     | YES      |         |             |
| `content_hash`           | text                     | YES      |         |             |
| `status`                 | text                     | YES      |         |             |
| `content_type`           | text                     | YES      |         |             |
| `payload`                | jsonb                    | YES      |         |             |
| `payload_schema_version` | integer                  | YES      |         |             |
| `raw_ref`                | text                     | YES      |         |             |
| `thumb_ref`              | text                     | YES      |         |             |
| `etag`                   | text                     | YES      |         |             |
| `last_modified`          | timestamp with time zone | YES      |         |             |
| `discovered_at`          | timestamp with time zone | YES      |         |             |
| `fetched_at`             | timestamp with time zone | YES      |         |             |
| `reviewed_at`            | timestamp with time zone | YES      |         |             |
| `reviewer`               | uuid                     | YES      |         |             |
| `rejection_reason`       | text                     | YES      |         |             |
| `prompt_version`         | text                     | YES      |         |             |
| `model_id`               | text                     | YES      |         |             |
| `agent_metadata`         | jsonb                    | YES      |         |             |
| `stg_id`                 | uuid                     | YES      |         |             |
| `approved_at`            | timestamp with time zone | YES      |         |             |
| `relevance_score`        | numeric                  | YES      |         |             |
| `executive_summary`      | text                     | YES      |         |             |
| `skip_reason`            | text                     | YES      |         |             |
| `status_code`            | smallint                 | YES      |         |             |
| `entry_type`             | text                     | YES      |         |             |
| `status_name`            | text                     | YES      |         |             |
| `status_category`        | text                     | YES      |         |             |
| `is_terminal`            | boolean                  | YES      |         |             |

### `ingestion_review_queue`

**Rows:** 0

| Column           | Type                     | Nullable | Default | Constraints |
| ---------------- | ------------------------ | -------- | ------- | ----------- |
| `id`             | uuid                     | YES      |         |             |
| `url`            | text                     | YES      |         |             |
| `content_type`   | text                     | YES      |         |             |
| `title`          | text                     | YES      |         |             |
| `authors`        | jsonb                    | YES      |         |             |
| `published_at`   | text                     | YES      |         |             |
| `summary`        | jsonb                    | YES      |         |             |
| `tags`           | jsonb                    | YES      |         |             |
| `thumb_ref`      | text                     | YES      |         |             |
| `discovered_at`  | timestamp with time zone | YES      |         |             |
| `fetched_at`     | timestamp with time zone | YES      |         |             |
| `status`         | text                     | YES      |         |             |
| `prompt_version` | text                     | YES      |         |             |
| `model_id`       | text                     | YES      |         |             |

### `kb_audience`

**Rows:** 4

| Column              | Type    | Nullable | Default           | Constraints |
| ------------------- | ------- | -------- | ----------------- | ----------- |
| `code`              | text    | NO       |                   | UNIQUE      |
| `name`              | text    | NO       |                   |             |
| `description`       | text    | YES      |                   |             |
| `sort_order`        | integer | YES      | 0                 |             |
| `id`                | uuid    | NO       | gen_random_uuid() | PK          |
| `cares_about`       | text    | YES      |                   |             |
| `doesnt_care_about` | text    | YES      |                   |             |
| `scoring_guide`     | text    | YES      |                   |             |

### `kb_category`

**Rows:** 9

| Column        | Type    | Nullable | Default | Constraints |
| ------------- | ------- | -------- | ------- | ----------- |
| `slug`        | text    | NO       |         | PK          |
| `name`        | text    | NO       |         |             |
| `description` | text    | YES      |         |             |
| `sort_order`  | integer | YES      | 100     |             |

### `kb_channel`

**Rows:** 7

| Column        | Type                     | Nullable | Default | Constraints |
| ------------- | ------------------------ | -------- | ------- | ----------- |
| `slug`        | text                     | NO       |         | PK          |
| `name`        | text                     | NO       |         |             |
| `description` | text                     | YES      |         |             |
| `icon`        | text                     | YES      |         |             |
| `sort_order`  | integer                  | YES      | 100     |             |
| `created_at`  | timestamp with time zone | YES      | now()   |             |

### `kb_geography`

**Rows:** 30

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `code`        | text                     | NO       |                   | UNIQUE      |
| `name`        | text                     | NO       |                   |             |
| `sort_order`  | integer                  | NO       |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | NO       | now()             |             |
| `updated_at`  | timestamp with time zone | NO       | now()             |             |
| `level`       | integer                  | YES      | 4                 |             |
| `parent_code` | text                     | YES      |                   |             |

### `kb_publication`

**Rows:** 138

| Column                 | Type                     | Nullable | Default           | Constraints             |
| ---------------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`                   | uuid                     | NO       | gen_random_uuid() | PK                      |
| `slug`                 | text                     | NO       |                   | UNIQUE                  |
| `title`                | text                     | NO       |                   |                         |
| `author`               | text                     | YES      |                   |                         |
| `date_published`       | timestamp with time zone | YES      |                   |                         |
| `date_added`           | timestamp with time zone | YES      | now()             |                         |
| `last_edited`          | timestamp with time zone | YES      | now()             |                         |
| `source_url`           | text                     | NO       |                   |                         |
| `source_name`          | text                     | YES      |                   |                         |
| `source_domain`        | text                     | YES      |                   |                         |
| `thumbnail`            | text                     | YES      |                   |                         |
| `summary_short`        | text                     | YES      |                   |                         |
| `summary_medium`       | text                     | YES      |                   |                         |
| `summary_long`         | text                     | YES      |                   |                         |
| `audience`             | text                     | YES      |                   |                         |
| `content_type`         | text                     | YES      |                   |                         |
| `geography`            | text                     | YES      |                   |                         |
| `use_cases`            | text                     | YES      |                   |                         |
| `agentic_capabilities` | text                     | YES      |                   |                         |
| `status`               | text                     | YES      | 'draft'::text     |                         |
| `origin_queue_id`      | uuid                     | YES      |                   | FK → ingestion_queue.id |
| `thumbnail_bucket`     | text                     | YES      | 'asset'::text     |                         |
| `thumbnail_path`       | text                     | YES      |                   |                         |
| `summary_structured`   | jsonb                    | YES      |                   |                         |

### `kb_publication_ag_vendor`

**Rows:** 0

| Column           | Type    | Nullable | Default | Constraints            |
| ---------------- | ------- | -------- | ------- | ---------------------- |
| `publication_id` | uuid    | NO       |         | PK                     |
| `publication_id` | uuid    | NO       |         | FK → kb_publication.id |
| `vendor_id`      | uuid    | NO       |         | PK                     |
| `vendor_id`      | uuid    | NO       |         | FK → ag_vendor.id      |
| `rank`           | integer | YES      | 0       |                        |

### `kb_publication_bfsi_industry`

**Rows:** 176

| Column           | Type    | Nullable | Default | Constraints            |
| ---------------- | ------- | -------- | ------- | ---------------------- |
| `publication_id` | uuid    | NO       |         | PK                     |
| `publication_id` | uuid    | NO       |         | FK → kb_publication.id |
| `industry_code`  | text    | NO       |         | PK                     |
| `rank`           | integer | YES      | 0       |                        |

### `kb_publication_bfsi_organization`

**Rows:** 0

| Column            | Type    | Nullable | Default | Constraints               |
| ----------------- | ------- | -------- | ------- | ------------------------- |
| `publication_id`  | uuid    | NO       |         | PK                        |
| `publication_id`  | uuid    | NO       |         | FK → kb_publication.id    |
| `organization_id` | uuid    | NO       |         | PK                        |
| `organization_id` | uuid    | NO       |         | FK → bfsi_organization.id |
| `rank`            | integer | YES      | 0       |                           |

### `kb_publication_bfsi_process`

**Rows:** 7

| Column           | Type                     | Nullable | Default | Constraints            |
| ---------------- | ------------------------ | -------- | ------- | ---------------------- |
| `process_code`   | text                     | NO       |         | PK                     |
| `process_code`   | text                     | NO       |         | FK → bfsi_process.code |
| `rank`           | integer                  | YES      | 0       |                        |
| `confidence`     | numeric                  | YES      |         |                        |
| `created_at`     | timestamp with time zone | YES      | now()   |                        |
| `publication_id` | uuid                     | NO       |         | PK                     |

### `kb_publication_bfsi_topic`

**Rows:** 122

| Column           | Type    | Nullable | Default | Constraints            |
| ---------------- | ------- | -------- | ------- | ---------------------- |
| `publication_id` | uuid    | NO       |         | FK → kb_publication.id |
| `publication_id` | uuid    | NO       |         | PK                     |
| `topic_code`     | text    | NO       |         | PK                     |
| `rank`           | integer | YES      | 0       |                        |

### `kb_publication_obligation`

**Rows:** 0

| Column            | Type | Nullable | Default | Constraints            |
| ----------------- | ---- | -------- | ------- | ---------------------- |
| `publication_id`  | uuid | NO       |         | PK                     |
| `publication_id`  | uuid | NO       |         | FK → kb_publication.id |
| `obligation_code` | text | NO       |         | FK → obligation.code   |
| `obligation_code` | text | NO       |         | PK                     |

### `kb_publication_pretty`

**Rows:** 138

| Column             | Type                     | Nullable | Default | Constraints |
| ------------------ | ------------------------ | -------- | ------- | ----------- |
| `id`               | uuid                     | YES      |         |             |
| `slug`             | text                     | YES      |         |             |
| `title`            | text                     | YES      |         |             |
| `author`           | text                     | YES      |         |             |
| `date_published`   | timestamp with time zone | YES      |         |             |
| `date_added`       | timestamp with time zone | YES      |         |             |
| `last_edited`      | timestamp with time zone | YES      |         |             |
| `source_url`       | text                     | YES      |         |             |
| `source_name`      | text                     | YES      |         |             |
| `source_domain`    | text                     | YES      |         |             |
| `thumbnail`        | text                     | YES      |         |             |
| `thumbnail_bucket` | text                     | YES      |         |             |
| `thumbnail_path`   | text                     | YES      |         |             |
| `summary_short`    | text                     | YES      |         |             |
| `summary_medium`   | text                     | YES      |         |             |
| `summary_long`     | text                     | YES      |         |             |
| `content_type`     | text                     | YES      |         |             |
| `audience`         | text                     | YES      |         |             |
| `geography`        | text                     | YES      |         |             |
| `status`           | text                     | YES      |         |             |
| `industry`         | text                     | YES      |         |             |
| `topic`            | text                     | YES      |         |             |
| `industries`       | ARRAY                    | YES      |         |             |
| `topics`           | ARRAY                    | YES      |         |             |
| `regulators`       | ARRAY                    | YES      |         |             |
| `regulations`      | ARRAY                    | YES      |         |             |
| `obligations`      | ARRAY                    | YES      |         |             |
| `processes`        | ARRAY                    | YES      |         |             |

### `kb_publication_regulation`

**Rows:** 0

| Column            | Type | Nullable | Default | Constraints            |
| ----------------- | ---- | -------- | ------- | ---------------------- |
| `publication_id`  | uuid | NO       |         | PK                     |
| `publication_id`  | uuid | NO       |         | FK → kb_publication.id |
| `regulation_code` | text | NO       |         | PK                     |

### `kb_publication_regulator`

**Rows:** 8

| Column           | Type | Nullable | Default | Constraints            |
| ---------------- | ---- | -------- | ------- | ---------------------- |
| `publication_id` | uuid | NO       |         | FK → kb_publication.id |
| `publication_id` | uuid | NO       |         | PK                     |
| `regulator_code` | text | NO       |         | PK                     |

### `kb_publication_standard`

**Rows:** 0

| Column           | Type                     | Nullable | Default | Constraints      |
| ---------------- | ------------------------ | -------- | ------- | ---------------- |
| `resource_id`    | integer                  | NO       |         | PK               |
| `standard_id`    | bigint                   | NO       |         | PK               |
| `standard_id`    | bigint                   | NO       |         | FK → standard.id |
| `rank`           | integer                  | YES      | 0       |                  |
| `created_at`     | timestamp with time zone | YES      | now()   |                  |
| `publication_id` | uuid                     | YES      |         |                  |

### `kb_publication_type`

**Rows:** 10

| Column        | Type                     | Nullable | Default        | Constraints |
| ------------- | ------------------------ | -------- | -------------- | ----------- |
| `code`        | text                     | NO       |                | PK          |
| `label`       | text                     | NO       |                |             |
| `description` | text                     | YES      |                |             |
| `sort_order`  | integer                  | NO       | 100            |             |
| `status`      | text                     | NO       | 'active'::text |             |
| `created_at`  | timestamp with time zone | NO       | now()          |             |
| `updated_at`  | timestamp with time zone | NO       | now()          |             |

### `kb_rejection_pattern`

**Rows:** 7

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `name`        | text                     | NO       |                   | UNIQUE      |
| `category`    | text                     | NO       |                   |             |
| `description` | text                     | NO       |                   |             |
| `patterns`    | ARRAY                    | NO       |                   |             |
| `max_score`   | smallint                 | NO       | 2                 |             |
| `is_active`   | boolean                  | NO       | true              |             |
| `sort_order`  | smallint                 | NO       | 100               |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |
| `updated_at`  | timestamp with time zone | YES      | now()             |             |

### `kb_source`

**Rows:** 83

| Column                  | Type                     | Nullable | Default           | Constraints           |
| ----------------------- | ------------------------ | -------- | ----------------- | --------------------- |
| `slug`                  | text                     | NO       |                   | PK                    |
| `name`                  | text                     | NO       |                   | UNIQUE                |
| `domain`                | text                     | YES      |                   |                       |
| `tier`                  | text                     | NO       |                   |                       |
| `category`              | text                     | NO       |                   |                       |
| `description`           | text                     | YES      |                   |                       |
| `rss_feed`              | text                     | YES      |                   |                       |
| `enabled`               | boolean                  | YES      | true              |                       |
| `sort_order`            | integer                  | YES      | 999               |                       |
| `created_at`            | timestamp with time zone | YES      | now()             |                       |
| `updated_at`            | timestamp with time zone | YES      | now()             |                       |
| `show_on_external_page` | boolean                  | YES      | false             |                       |
| `scraper_config`        | jsonb                    | YES      |                   |                       |
| `sitemap_url`           | text                     | YES      |                   |                       |
| `premium_config`        | jsonb                    | YES      |                   |                       |
| `channel_slug`          | text                     | YES      |                   | FK → kb_channel.slug  |
| `disabled_reason`       | text                     | YES      |                   |                       |
| `primary_audience`      | text                     | YES      |                   | FK → kb_audience.code |
| `id`                    | uuid                     | NO       | gen_random_uuid() | UNIQUE                |

### `missed_discovery`

**Rows:** 1

| Column                    | Type                     | Nullable | Default           | Constraints       |
| ------------------------- | ------------------------ | -------- | ----------------- | ----------------- |
| `id`                      | uuid                     | NO       | gen_random_uuid() | PK                |
| `url`                     | text                     | NO       |                   |                   |
| `url_norm`                | text                     | NO       |                   |                   |
| `submitter_name`          | text                     | YES      |                   |                   |
| `submitter_type`          | text                     | YES      |                   |                   |
| `submitter_audience`      | text                     | YES      |                   |                   |
| `submitter_channel`       | text                     | YES      |                   |                   |
| `submitted_at`            | timestamp with time zone | YES      | now()             |                   |
| `why_valuable`            | text                     | YES      |                   |                   |
| `submitter_urgency`       | text                     | YES      |                   |                   |
| `verbatim_comment`        | text                     | YES      |                   |                   |
| `suggested_audiences`     | ARRAY                    | YES      |                   |                   |
| `suggested_topics`        | ARRAY                    | YES      |                   |                   |
| `suggested_industries`    | ARRAY                    | YES      |                   |                   |
| `suggested_geographies`   | ARRAY                    | YES      |                   |                   |
| `source_domain`           | text                     | YES      |                   |                   |
| `source_type`             | text                     | YES      |                   |                   |
| `existing_source_slug`    | text                     | YES      |                   |                   |
| `miss_category`           | text                     | YES      |                   |                   |
| `miss_details`            | jsonb                    | YES      |                   |                   |
| `resolution_status`       | text                     | YES      | 'pending'::text   |                   |
| `resolution_action`       | text                     | YES      |                   |                   |
| `resolved_at`             | timestamp with time zone | YES      |                   |                   |
| `resolved_by`             | text                     | YES      |                   |                   |
| `improvement_suggestions` | jsonb                    | YES      |                   |                   |
| `contributed_to_source`   | uuid                     | YES      |                   | FK → kb_source.id |
| `contributed_to_pattern`  | text                     | YES      |                   |                   |
| `days_late`               | integer                  | YES      |                   |                   |
| `retroactive_score`       | integer                  | YES      |                   |                   |
| `created_at`              | timestamp with time zone | YES      | now()             |                   |
| `updated_at`              | timestamp with time zone | YES      | now()             |                   |

### `obligation`

**Rows:** 18

| Column              | Type                     | Nullable | Default           | Constraints |
| ------------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`                | uuid                     | NO       | gen_random_uuid() | PK          |
| `code`              | text                     | NO       |                   | UNIQUE      |
| `name`              | text                     | NO       |                   |             |
| `description`       | text                     | YES      |                   |             |
| `regulation_code`   | text                     | YES      |                   |             |
| `category`          | text                     | YES      |                   |             |
| `article_reference` | text                     | YES      |                   |             |
| `sort_order`        | integer                  | YES      | 0                 |             |
| `created_at`        | timestamp with time zone | YES      | now()             |             |
| `updated_at`        | timestamp with time zone | YES      | now()             |             |

### `obligation_pretty`

**Rows:** 18

| Column              | Type | Nullable | Default | Constraints |
| ------------------- | ---- | -------- | ------- | ----------- |
| `id`                | uuid | YES      |         |             |
| `code`              | text | YES      |         |             |
| `name`              | text | YES      |         |             |
| `description`       | text | YES      |         |             |
| `category`          | text | YES      |         |             |
| `article_reference` | text | YES      |         |             |
| `regulation_code`   | text | YES      |         |             |

### `pending_entity_proposals`

**Rows:** 0

| Column         | Type                     | Nullable | Default | Constraints |
| -------------- | ------------------------ | -------- | ------- | ----------- |
| `id`           | uuid                     | YES      |         |             |
| `entity_type`  | text                     | YES      |         |             |
| `name`         | text                     | YES      |         |             |
| `slug`         | text                     | YES      |         |             |
| `metadata`     | jsonb                    | YES      |         |             |
| `source_url`   | text                     | YES      |         |             |
| `created_at`   | timestamp with time zone | YES      |         |             |
| `source_title` | text                     | YES      |         |             |

### `process_taxonomy_apqc`

**Rows:** 54

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_basel`

**Rows:** 19

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_bian`

**Rows:** 24

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_fatf`

**Rows:** 17

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_gics`

**Rows:** 0

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_iso20022`

**Rows:** 13

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_nace`

**Rows:** 0

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_naics`

**Rows:** 0

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_sepa`

**Rows:** 1

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `process_taxonomy_solvencyii`

**Rows:** 10

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `taxonomy_id` | text                     | YES      |                   |             |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `prompt_ab_test`

**Rows:** 0

| Column              | Type                     | Nullable | Default           | Constraints |
| ------------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`                | uuid                     | NO       | gen_random_uuid() | PK          |
| `agent_name`        | text                     | NO       |                   |             |
| `variant_a_version` | text                     | NO       |                   |             |
| `variant_b_version` | text                     | NO       |                   |             |
| `traffic_split`     | numeric                  | NO       | 0.50              |             |
| `sample_size`       | integer                  | NO       | 100               |             |
| `items_processed`   | integer                  | YES      | 0                 |             |
| `items_variant_a`   | integer                  | YES      | 0                 |             |
| `items_variant_b`   | integer                  | YES      | 0                 |             |
| `status`            | text                     | NO       | 'draft'::text     |             |
| `results`           | jsonb                    | YES      | '{}'::jsonb       |             |
| `winner`            | text                     | YES      |                   |             |
| `name`              | text                     | YES      |                   |             |
| `notes`             | text                     | YES      |                   |             |
| `created_by`        | text                     | YES      |                   |             |
| `created_at`        | timestamp with time zone | YES      | now()             |             |
| `started_at`        | timestamp with time zone | YES      |                   |             |
| `completed_at`      | timestamp with time zone | YES      |                   |             |

### `prompt_ab_test_item`

**Rows:** 0

| Column              | Type                     | Nullable | Default           | Constraints             |
| ------------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`                | uuid                     | NO       | gen_random_uuid() | PK                      |
| `test_id`           | uuid                     | NO       |                   | FK → prompt_ab_test.id  |
| `queue_item_id`     | uuid                     | YES      |                   | FK → ingestion_queue.id |
| `variant`           | text                     | NO       |                   |                         |
| `output`            | jsonb                    | YES      |                   |                         |
| `latency_ms`        | integer                  | YES      |                   |                         |
| `input_tokens`      | integer                  | YES      |                   |                         |
| `output_tokens`     | integer                  | YES      |                   |                         |
| `confidence`        | numeric                  | YES      |                   |                         |
| `error_count`       | integer                  | YES      | 0                 |                         |
| `validation_passed` | boolean                  | YES      |                   |                         |
| `created_at`        | timestamp with time zone | YES      | now()             |                         |

### `prompt_version`

**Rows:** 11

| Column              | Type                     | Nullable | Default           | Constraints |
| ------------------- | ------------------------ | -------- | ----------------- | ----------- |
| `version`           | text                     | NO       |                   | UNIQUE      |
| `prompt_text`       | text                     | YES      |                   |             |
| `created_at`        | timestamp with time zone | YES      | now()             |             |
| `rejection_rate`    | numeric                  | YES      |                   |             |
| `avg_quality_score` | numeric                  | YES      |                   |             |
| `notes`             | text                     | YES      |                   |             |
| `agent_name`        | text                     | YES      |                   | UNIQUE      |
| `stage`             | text                     | YES      |                   |             |
| `model_id`          | text                     | YES      |                   |             |
| `is_current`        | boolean                  | YES      | true              |             |
| `id`                | uuid                     | NO       | gen_random_uuid() | PK          |

### `proposed_entity`

**Rows:** 0

| Column            | Type                     | Nullable | Default           | Constraints             |
| ----------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`              | uuid                     | NO       | gen_random_uuid() | PK                      |
| `entity_type`     | text                     | NO       |                   |                         |
| `name`            | text                     | NO       |                   |                         |
| `slug`            | text                     | NO       |                   |                         |
| `metadata`        | jsonb                    | YES      | '{}'::jsonb       |                         |
| `source_queue_id` | uuid                     | YES      |                   | FK → ingestion_queue.id |
| `source_url`      | text                     | YES      |                   |                         |
| `status`          | text                     | NO       | 'pending'::text   |                         |
| `reviewed_at`     | timestamp with time zone | YES      |                   |                         |
| `reviewed_by`     | uuid                     | YES      |                   |                         |
| `review_notes`    | text                     | YES      |                   |                         |
| `created_at`      | timestamp with time zone | NO       | now()             |                         |
| `updated_at`      | timestamp with time zone | NO       | now()             |                         |

### `publication_edit_history`

**Rows:** 0

| Column           | Type                     | Nullable | Default | Constraints |
| ---------------- | ------------------------ | -------- | ------- | ----------- |
| `history_id`     | uuid                     | YES      |         |             |
| `publication_id` | text                     | YES      |         |             |
| `field_changes`  | jsonb                    | YES      |         |             |
| `changed_by`     | text                     | YES      |         |             |
| `changed_at`     | timestamp with time zone | YES      |         |             |
| `queue_id`       | uuid                     | YES      |         |             |

### `ref_filter_config`

**Rows:** 8

| Column          | Type                     | Nullable | Default          | Constraints |
| --------------- | ------------------------ | -------- | ---------------- | ----------- |
| `column_name`   | text                     | NO       |                  | PK          |
| `display_label` | text                     | NO       |                  |             |
| `filter_type`   | text                     | NO       | 'dropdown'::text |             |
| `sort_order`    | integer                  | NO       | 0                |             |
| `enabled`       | boolean                  | NO       | true             |             |
| `description`   | text                     | YES      |                  |             |
| `created_at`    | timestamp with time zone | YES      | now()            |             |
| `updated_at`    | timestamp with time zone | YES      | now()            |             |

### `regulation`

**Rows:** 18

| Column            | Type                     | Nullable | Default | Constraints       |
| ----------------- | ------------------------ | -------- | ------- | ----------------- |
| `id`              | integer                  | NO       |         | PK                |
| `code`            | text                     | YES      |         | UNIQUE            |
| `title`           | text                     | NO       |         |                   |
| `instrument_type` | text                     | YES      |         |                   |
| `jurisdiction`    | text                     | YES      |         |                   |
| `scope_goals`     | text                     | YES      |         |                   |
| `status`          | text                     | YES      |         |                   |
| `effective_from`  | date                     | YES      |         |                   |
| `effective_to`    | date                     | YES      |         |                   |
| `obligations`     | jsonb                    | YES      |         |                   |
| `deadlines`       | jsonb                    | YES      |         |                   |
| `sources`         | jsonb                    | YES      |         |                   |
| `notes`           | text                     | YES      |         |                   |
| `created_at`      | timestamp with time zone | YES      | now()   |                   |
| `updated_at`      | timestamp with time zone | YES      | now()   |                   |
| `regulator_id`    | bigint                   | YES      |         | FK → regulator.id |
| `domain`          | text                     | YES      |         |                   |

### `regulation_obligations_pretty`

**Rows:** ?

| Column           | Type    | Nullable | Default | Constraints |
| ---------------- | ------- | -------- | ------- | ----------- |
| `id`             | integer | YES      |         |             |
| `code`           | text    | YES      |         |             |
| `title`          | text    | YES      |         |             |
| `obligation`     | text    | YES      |         |             |
| `domain`         | text    | YES      |         |             |
| `regulator_name` | text    | YES      |         |             |

### `regulation_pretty`

**Rows:** ?

| Column                   | Type                     | Nullable | Default | Constraints |
| ------------------------ | ------------------------ | -------- | ------- | ----------- |
| `id`                     | integer                  | YES      |         |             |
| `code`                   | text                     | YES      |         |             |
| `title`                  | text                     | YES      |         |             |
| `instrument_type`        | text                     | YES      |         |             |
| `jurisdiction`           | text                     | YES      |         |             |
| `regulator_name`         | text                     | YES      |         |             |
| `scope_goals`            | text                     | YES      |         |             |
| `status`                 | text                     | YES      |         |             |
| `effective_from`         | date                     | YES      |         |             |
| `effective_to`           | date                     | YES      |         |             |
| `obligations`            | jsonb                    | YES      |         |             |
| `deadlines`              | jsonb                    | YES      |         |             |
| `sources`                | jsonb                    | YES      |         |             |
| `notes`                  | text                     | YES      |         |             |
| `created_at`             | timestamp with time zone | YES      |         |             |
| `updated_at`             | timestamp with time zone | YES      |         |             |
| `regulator_id`           | bigint                   | YES      |         |             |
| `regulator_slug`         | text                     | YES      |         |             |
| `regulator_website_url`  | text                     | YES      |         |             |
| `regulator_jurisdiction` | text                     | YES      |         |             |
| `domain`                 | text                     | YES      |         |             |

### `regulator`

**Rows:** 22

| Column         | Type                     | Nullable | Default | Constraints |
| -------------- | ------------------------ | -------- | ------- | ----------- |
| `id`           | bigint                   | NO       |         | PK          |
| `name`         | text                     | NO       |         |             |
| `slug`         | text                     | NO       |         | UNIQUE      |
| `website_url`  | text                     | YES      |         |             |
| `jurisdiction` | text                     | YES      |         |             |
| `notes`        | text                     | YES      |         |             |
| `created_at`   | timestamp with time zone | NO       | now()   |             |
| `updated_at`   | timestamp with time zone | NO       | now()   |             |
| `domain`       | text                     | YES      |         |             |

### `regulator_pretty`

**Rows:** ?

| Column         | Type   | Nullable | Default | Constraints |
| -------------- | ------ | -------- | ------- | ----------- |
| `id`           | bigint | YES      |         |             |
| `name`         | text   | YES      |         |             |
| `slug`         | text   | YES      |         |             |
| `jurisdiction` | text   | YES      |         |             |
| `website_url`  | text   | YES      |         |             |

### `rejection_analytics`

**Rows:** 0

| Column               | Type                     | Nullable | Default                           | Constraints             |
| -------------------- | ------------------------ | -------- | --------------------------------- | ----------------------- |
| `id`                 | integer                  | NO       | nextval('rejection_analytics_i... | PK                      |
| `rejection_reason`   | text                     | YES      |                                   |                         |
| `rejection_category` | text                     | YES      |                                   |                         |
| `queue_item_id`      | uuid                     | YES      |                                   | FK → ingestion_queue.id |
| `discovered_source`  | text                     | YES      |                                   |                         |
| `industry`           | text                     | YES      |                                   |                         |
| `topic`              | text                     | YES      |                                   |                         |
| `created_at`         | timestamp with time zone | YES      | now()                             |                         |
| `prompt_version_id`  | uuid                     | YES      |                                   | FK → prompt_version.id  |

### `rls_status`

**Rows:** 69

| Column        | Type    | Nullable | Default | Constraints |
| ------------- | ------- | -------- | ------- | ----------- |
| `table_name`  | name    | YES      |         |             |
| `rls_enabled` | boolean | YES      |         |             |

### `standard`

**Rows:** 0

| Column               | Type                     | Nullable | Default        | Constraints             |
| -------------------- | ------------------------ | -------- | -------------- | ----------------------- |
| `id`                 | bigint                   | NO       |                | PK                      |
| `name`               | text                     | NO       |                |                         |
| `slug`               | text                     | NO       |                | UNIQUE                  |
| `version`            | text                     | YES      |                |                         |
| `status`             | text                     | YES      | 'active'::text |                         |
| `published_on`       | date                     | YES      |                |                         |
| `last_revised_on`    | date                     | YES      |                |                         |
| `summary`            | text                     | YES      |                |                         |
| `source_url`         | text                     | YES      |                |                         |
| `standard_setter_id` | bigint                   | YES      |                | FK → standard_setter.id |
| `regulator_id`       | bigint                   | YES      |                | FK → regulator.id       |
| `created_at`         | timestamp with time zone | NO       | now()          |                         |
| `updated_at`         | timestamp with time zone | NO       | now()          |                         |
| `domain`             | text                     | YES      |                |                         |

### `standard_setter`

**Rows:** 10

| Column         | Type                     | Nullable | Default | Constraints |
| -------------- | ------------------------ | -------- | ------- | ----------- |
| `id`           | bigint                   | NO       |         | PK          |
| `name`         | text                     | NO       |         |             |
| `slug`         | text                     | NO       |         | UNIQUE      |
| `website_url`  | text                     | YES      |         |             |
| `country_code` | character                | YES      |         |             |
| `notes`        | text                     | YES      |         |             |
| `created_at`   | timestamp with time zone | NO       | now()   |             |
| `updated_at`   | timestamp with time zone | NO       | now()   |             |
| `domain`       | text                     | YES      |         |             |

### `status_history`

**Rows:** 2361

| Column        | Type                     | Nullable | Default           | Constraints             |
| ------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK                      |
| `queue_id`    | uuid                     | YES      |                   | FK → ingestion_queue.id |
| `from_status` | smallint                 | YES      |                   | FK → status_lookup.code |
| `to_status`   | smallint                 | NO       |                   | FK → status_lookup.code |
| `changed_at`  | timestamp with time zone | YES      | now()             |                         |
| `changed_by`  | text                     | YES      |                   |                         |
| `changes`     | jsonb                    | YES      |                   |                         |
| `duration_ms` | integer                  | YES      |                   |                         |
| `created_at`  | timestamp with time zone | YES      | now()             |                         |

### `status_lookup`

**Rows:** 30

| Column        | Type     | Nullable | Default | Constraints |
| ------------- | -------- | -------- | ------- | ----------- |
| `code`        | smallint | NO       |         | PK          |
| `name`        | text     | NO       |         | UNIQUE      |
| `description` | text     | YES      |         |             |
| `category`    | text     | NO       |         |             |
| `is_terminal` | boolean  | YES      | false   |             |
| `sort_order`  | smallint | YES      |         |             |

### `tables_columns`

**Rows:** 69

| Column       | Type | Nullable | Default | Constraints |
| ------------ | ---- | -------- | ------- | ----------- |
| `table_name` | name | YES      |         |             |
| `columns`    | text | YES      |         |             |

### `taxonomy_bian`

**Rows:** 60

| Column               | Type                     | Nullable | Default           | Constraints |
| -------------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`                 | uuid                     | NO       | gen_random_uuid() | PK          |
| `code`               | text                     | YES      |                   |             |
| `description`        | text                     | YES      |                   |             |
| `created_at`         | timestamp with time zone | YES      | now()             |             |
| `object_type`        | text                     | YES      |                   |             |
| `business_area`      | text                     | YES      |                   |             |
| `business_domain`    | text                     | YES      |                   |             |
| `service_domain`     | text                     | YES      |                   |             |
| `bian_version`       | text                     | YES      |                   |             |
| `parent_original_id` | integer                  | YES      |                   |             |
| `updated_at`         | timestamp with time zone | YES      |                   |             |
| `external_id`        | text                     | YES      |                   |             |
| `level`              | text                     | YES      |                   |             |
| `level_num`          | integer                  | YES      |                   |             |

### `taxonomy_bian_pretty`

**Rows:** 60

| Column            | Type                     | Nullable | Default | Constraints |
| ----------------- | ------------------------ | -------- | ------- | ----------- |
| `id`              | uuid                     | YES      |         |             |
| `code`            | text                     | YES      |         |             |
| `description`     | text                     | YES      |         |             |
| `level`           | text                     | YES      |         |             |
| `level_num`       | integer                  | YES      |         |             |
| `business_area`   | text                     | YES      |         |             |
| `business_domain` | text                     | YES      |         |             |
| `service_domain`  | text                     | YES      |         |             |
| `root_code`       | text                     | YES      |         |             |
| `parent_code`     | text                     | YES      |         |             |
| `hierarchy_path`  | text                     | YES      |         |             |
| `bian_version`    | text                     | YES      |         |             |
| `created_at`      | timestamp with time zone | YES      |         |             |
| `updated_at`      | timestamp with time zone | YES      |         |             |

### `taxonomy_config`

**Rows:** 12

| Column                   | Type                     | Nullable | Default           | Constraints |
| ------------------------ | ------------------------ | -------- | ----------------- | ----------- |
| `id`                     | uuid                     | NO       | gen_random_uuid() | PK          |
| `slug`                   | text                     | NO       |                   | UNIQUE      |
| `display_name`           | text                     | NO       |                   |             |
| `display_name_plural`    | text                     | YES      |                   |             |
| `display_order`          | integer                  | NO       |                   |             |
| `behavior_type`          | text                     | NO       |                   |             |
| `source_table`           | text                     | YES      |                   |             |
| `source_code_column`     | text                     | YES      | 'code'::text      |             |
| `source_name_column`     | text                     | YES      | 'name'::text      |             |
| `is_hierarchical`        | boolean                  | YES      | false             |             |
| `parent_code_column`     | text                     | YES      |                   |             |
| `junction_table`         | text                     | YES      |                   |             |
| `junction_code_column`   | text                     | YES      |                   |             |
| `payload_field`          | text                     | NO       |                   |             |
| `include_list_in_prompt` | boolean                  | YES      | true              |             |
| `prompt_section_title`   | text                     | YES      |                   |             |
| `prompt_instruction`     | text                     | YES      |                   |             |
| `min_confidence`         | real                     | YES      | 0.3               |             |
| `color`                  | text                     | YES      | 'neutral'::text   |             |
| `show_confidence`        | boolean                  | YES      | false             |             |
| `empty_placeholder`      | text                     | YES      | '—'::text         |             |
| `score_parent_slug`      | text                     | YES      |                   |             |
| `score_threshold`        | real                     | YES      | 0.5               |             |
| `is_active`              | boolean                  | YES      | true              |             |
| `created_at`             | timestamp with time zone | YES      | now()             |             |
| `updated_at`             | timestamp with time zone | YES      | now()             |             |

### `taxonomy_gics`

**Rows:** 14

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `taxonomy_nace`

**Rows:** 35

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `taxonomy_naics`

**Rows:** 20

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `original_id` | integer                  | YES      |                   | UNIQUE      |
| `code`        | text                     | YES      |                   |             |
| `description` | text                     | YES      |                   |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |

### `v_queue_daily_stats`

**Rows:** 0

| Column        | Type   | Nullable | Default | Constraints |
| ------------- | ------ | -------- | ------- | ----------- |
| `review_date` | date   | YES      |         |             |
| `status`      | text   | YES      |         |             |
| `count`       | bigint | YES      |         |             |

### `v_queue_health`

**Rows:** 4

| Column       | Type                     | Nullable | Default | Constraints |
| ------------ | ------------------------ | -------- | ------- | ----------- |
| `status`     | text                     | YES      |         |             |
| `age_bucket` | text                     | YES      |         |             |
| `count`      | bigint                   | YES      |         |             |
| `oldest`     | timestamp with time zone | YES      |         |             |
| `newest`     | timestamp with time zone | YES      |         |             |

### `v_queue_pending_by_source`

**Rows:** 0

| Column           | Type                     | Nullable | Default | Constraints |
| ---------------- | ------------------------ | -------- | ------- | ----------- |
| `source`         | text                     | YES      |         |             |
| `pending_count`  | bigint                   | YES      |         |             |
| `oldest_pending` | timestamp with time zone | YES      |         |             |
| `avg_age_days`   | numeric                  | YES      |         |             |

### `views`

**Rows:** 15

| Column            | Type              | Nullable | Default | Constraints |
| ----------------- | ----------------- | -------- | ------- | ----------- |
| `table_name`      | name              | YES      |         |             |
| `view_definition` | character varying | YES      |         |             |

### `writing_rules`

**Rows:** 14

| Column       | Type                     | Nullable | Default           | Constraints |
| ------------ | ------------------------ | -------- | ----------------- | ----------- |
| `id`         | uuid                     | NO       | gen_random_uuid() | PK          |
| `category`   | text                     | NO       |                   |             |
| `rule_name`  | text                     | NO       |                   |             |
| `rule_text`  | text                     | NO       |                   |             |
| `examples`   | text                     | YES      |                   |             |
| `priority`   | integer                  | YES      | 50                |             |
| `is_active`  | boolean                  | YES      | true              |             |
| `created_at` | timestamp with time zone | YES      | now()             |             |
| `updated_at` | timestamp with time zone | YES      | now()             |             |
