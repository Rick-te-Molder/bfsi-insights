# Database Schema Reference

> **Auto-generated** by `npm run dump:schema`  
> **Last updated:** 2026-01-30T07:57:22.781Z

This file is the single source of truth for AI assistants to understand the database structure.

## Quick Reference

| Table                              | Rows | Purpose            |
| ---------------------------------- | ---- | ------------------ |
| `ag_capability`                    | 24   | PK: id             |
| `ag_use_case`                      | 16   | PK: id             |
| `ag_use_case_audit`                | 16   | PK: audit_id       |
| `ag_use_case_capability`           | 203  | PK: capability_id  |
| `ag_vendor`                        | 81   | PK: id             |
| `agent_jobs`                       | 37   | PK: id             |
| `agent_run`                        | 4257 | PK: id             |
| `agent_run_metric`                 | 115  | PK: run_id         |
| `agent_run_step`                   | 4561 | PK: id             |
| `agent_run_summary`                | 4257 |                    |
| `app_admins`                       | 1    | PK: user_id        |
| `audit_log`                        | 3903 | PK: id             |
| `bfsi_entity_type`                 | 24   | PK: id             |
| `bfsi_industry`                    | 53   | PK: id             |
| `bfsi_industry_pretty`             | 53   |                    |
| `bfsi_organization`                | 10   | PK: id             |
| `bfsi_process`                     | 237  | PK: id             |
| `bfsi_process_pretty`              | 142  |                    |
| `bfsi_process_ref_rules`           | 30   | PK: id             |
| `bfsi_process_reference`           | 161  | PK: id             |
| `classic_papers`                   | 15   | PK: id             |
| `discovery_metrics`                | 0    | PK: id             |
| `eval_golden_set`                  | 24   | PK: id             |
| `eval_result`                      | 0    | PK: id             |
| `eval_run`                         | 6    | PK: id             |
| `ingestion_queue`                  | 2709 | PK: id             |
| `ingestion_queue_archive`          | 0    | PK: id             |
| `ingestion_queue_with_transitions` | 2709 |                    |
| `kb_audience`                      | 4    | PK: id             |
| `kb_category`                      | 9    | PK: id             |
| `kb_channel`                       | 7    | PK: id             |
| `kb_geography`                     | 30   | PK: id             |
| `kb_publication`                   | 147  | PK: id             |
| `kb_publication_ag_vendor`         | 0    | PK: publication_id |
| `kb_publication_audience`          | 178  | PK: publication_id |
| `kb_publication_bfsi_industry`     | 172  | PK: publication_id |
| `kb_publication_bfsi_organization` | 2    | PK: publication_id |
| `kb_publication_bfsi_process`      | 7    | PK: process_code   |
| `kb_publication_bfsi_topic`        | 1    | PK: publication_id |
| `kb_publication_kb_topic`          | 121  | PK: publication_id |
| `kb_publication_obligation`        | 0    | PK: publication_id |
| `kb_publication_pretty`            | 147  |                    |
| `kb_publication_regulation`        | 0    | PK: publication_id |
| `kb_publication_regulator`         | 8    | PK: publication_id |
| `kb_publication_standard`          | 0    | PK: resource_id    |
| `kb_publication_type`              | 10   | PK: code           |
| `kb_rejection_pattern`             | 7    | PK: id             |
| `kb_source`                        | 83   | PK: slug           |
| `kb_topic`                         | 5    | PK: id             |
| `missed_discovery`                 | 10   | PK: id             |
| `obligation`                       | 18   | PK: id             |
| `obligation_pretty`                | 18   |                    |
| `pending_entity_proposals`         | 2    |                    |
| `pipeline_definition`              | 2    | PK: id             |
| `pipeline_entry_rule`              | 3    | PK: id             |
| `pipeline_execution`               | 0    | PK: id             |
| `pipeline_exit_rule`               | 3    | PK: id             |
| `pipeline_run`                     | 387  | PK: id             |
| `pipeline_run_costs`               | 254  |                    |
| `pipeline_step`                    | 8    | PK: id             |
| `pipeline_step_run`                | 806  | PK: id             |
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
| `prompt_ab_test`                   | 1    | PK: id             |
| `prompt_ab_test_item`              | 0    | PK: id             |
| `prompt_version`                   | 21   | PK: id             |
| `proposed_entity`                  | 2    | PK: id             |
| `publication_edit_history`         | 0    |                    |
| `raw_object`                       | 662  | PK: content_hash   |
| `ref_filter_config`                | 8    | PK: column_name    |
| `regulation`                       | 18   | PK: id             |
| `regulation_obligations_pretty`    | 46   |                    |
| `regulation_pretty`                | 18   |                    |
| `regulator`                        | 22   | PK: id             |
| `regulator_pretty`                 | 22   |                    |
| `rejection_analytics`              | 1    | PK: id             |
| `retry_policy`                     | 5    | PK: step_name      |
| `retry_queue_ready`                | 0    |                    |
| `review_queue_ready`               | 149  |                    |

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
| `id`                  | uuid                     | NO       |               | PK                     |

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
| `capability_id` | bigint                   | NO       |                  | FK → ag_capability.id |
| `capability_id` | bigint                   | NO       |                  | PK                    |
| `relation_type` | text                     | NO       | 'required'::text |                       |
| `weight`        | numeric                  | YES      |                  |                       |
| `rationale`     | text                     | YES      |                  |                       |
| `created_at`    | timestamp with time zone | NO       | now()            |                       |
| `updated_at`    | timestamp with time zone | NO       | now()            |                       |
| `use_case_id`   | uuid                     | NO       |                  | FK → ag_use_case.id   |
| `use_case_id`   | uuid                     | NO       |                  | PK                    |

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
| `slug`            | text                     | NO       |                   | UNIQUE      |

### `agent_jobs`

**Rows:** 37

| Column               | Type                     | Nullable | Default           | Constraints |
| -------------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`                 | uuid                     | NO       | gen_random_uuid() | PK          |
| `agent_name`         | text                     | NO       |                   |             |
| `status`             | text                     | NO       | 'pending'::text   |             |
| `total_items`        | integer                  | NO       | 0                 |             |
| `processed_items`    | integer                  | NO       | 0                 |             |
| `success_count`      | integer                  | NO       | 0                 |             |
| `failed_count`       | integer                  | NO       | 0                 |             |
| `current_item_id`    | uuid                     | YES      |                   |             |
| `current_item_title` | text                     | YES      |                   |             |
| `started_at`         | timestamp with time zone | YES      |                   |             |
| `completed_at`       | timestamp with time zone | YES      |                   |             |
| `created_at`         | timestamp with time zone | NO       | now()             |             |
| `created_by`         | text                     | YES      | 'manual'::text    |             |
| `error_message`      | text                     | YES      |                   |             |

### `agent_run`

**Rows:** 4257

| Column              | Type                     | Nullable | Default           | Constraints                |
| ------------------- | ------------------------ | -------- | ----------------- | -------------------------- |
| `id`                | uuid                     | NO       | gen_random_uuid() | PK                         |
| `queue_id`          | uuid                     | YES      |                   | FK → ingestion_queue.id    |
| `stg_id`            | uuid                     | YES      |                   | FK → kb_publication_stg.id |
| `agent_name`        | text                     | NO       |                   |                            |
| `stage`             | text                     | YES      |                   |                            |
| `model_id`          | text                     | YES      |                   |                            |
| `prompt_version`    | text                     | YES      |                   |                            |
| `started_at`        | timestamp with time zone | NO       | now()             |                            |
| `finished_at`       | timestamp with time zone | YES      |                   |                            |
| `status`            | text                     | NO       | 'running'::text   |                            |
| `error_message`     | text                     | YES      |                   |                            |
| `agent_metadata`    | jsonb                    | YES      |                   |                            |
| `publication_id`    | uuid                     | YES      |                   | FK → kb_publication.id     |
| `prompt_version_id` | uuid                     | YES      |                   | FK → prompt_version.id     |

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

**Rows:** 4561

| Column              | Type                     | Nullable | Default           | Constraints            |
| ------------------- | ------------------------ | -------- | ----------------- | ---------------------- |
| `id`                | uuid                     | NO       | gen_random_uuid() | PK                     |
| `run_id`            | uuid                     | NO       |                   | FK → agent_run.id      |
| `step_order`        | integer                  | NO       |                   |                        |
| `step_type`         | text                     | YES      |                   |                        |
| `input_size`        | integer                  | YES      |                   |                        |
| `output_size`       | integer                  | YES      |                   |                        |
| `started_at`        | timestamp with time zone | NO       | now()             |                        |
| `finished_at`       | timestamp with time zone | YES      |                   |                        |
| `status`            | text                     | NO       | 'running'::text   |                        |
| `details`           | jsonb                    | YES      |                   |                        |
| `prompt_version_id` | uuid                     | YES      |                   | FK → prompt_version.id |

### `agent_run_summary`

**Rows:** 4257

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

### `audit_log`

**Rows:** 3903

| Column        | Type                     | Nullable | Default           | Constraints    |
| ------------- | ------------------------ | -------- | ----------------- | -------------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK             |
| `user_id`     | uuid                     | YES      |                   | FK → null.null |
| `user_email`  | text                     | YES      |                   |                |
| `action`      | text                     | NO       |                   |                |
| `entity_type` | text                     | NO       |                   |                |
| `entity_id`   | uuid                     | NO       |                   |                |
| `old_value`   | jsonb                    | YES      |                   |                |
| `new_value`   | jsonb                    | YES      |                   |                |
| `ip_address`  | inet                     | YES      |                   |                |
| `user_agent`  | text                     | YES      |                   |                |
| `created_at`  | timestamp with time zone | NO       | now()             |                |

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
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
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

**Rows:** 10

| Column                    | Type                     | Nullable | Default           | Constraints |
| ------------------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`                      | uuid                     | NO       | gen_random_uuid() | PK          |
| `name`                    | text                     | NO       |                   | UNIQUE      |
| `description`             | text                     | YES      |                   |             |
| `entity_type`             | text                     | YES      |                   |             |
| `headquarters_country`    | text                     | YES      |                   |             |
| `involvement_in_payments` | boolean                  | YES      |                   |             |
| `created_at`              | timestamp with time zone | NO       | now()             |             |
| `slug`                    | text                     | NO       |                   | UNIQUE      |

### `bfsi_process`

**Rows:** 237

| Column        | Type                     | Nullable | Default           | Constraints             |
| ------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK                      |
| `code`        | text                     | NO       |                   | UNIQUE                  |
| `name`        | text                     | NO       |                   |                         |
| `level`       | integer                  | NO       |                   |                         |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
| `sort_order`  | integer                  | YES      | 0                 |                         |
| `description` | text                     | YES      |                   |                         |
| `created_at`  | timestamp with time zone | YES      | now()             |                         |
| `updated_at`  | timestamp with time zone | YES      | now()             |                         |

### `bfsi_process_pretty`

**Rows:** 142

| Column             | Type | Nullable | Default | Constraints |
| ------------------ | ---- | -------- | ------- | ----------- |
| `l0_code`          | text | YES      |         |             |
| `l0_domain`        | text | YES      |         |             |
| `l1_code`          | text | YES      |         |             |
| `l1_process_group` | text | YES      |         |             |
| `l2_code`          | text | YES      |         |             |
| `l2_process`       | text | YES      |         |             |
| `l3_code`          | text | YES      |         |             |
| `l3_process_step`  | text | YES      |         |             |
| `path`             | text | YES      |         |             |

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
| `prompt_version_id`      | uuid                     | YES      |                   | FK → prompt_version.id  |
| `trigger_type`           | text                     | YES      |                   |                         |
| `baseline_score`         | numeric                  | YES      |                   |                         |
| `score_delta`            | numeric                  | YES      |                   |                         |
| `regression_detected`    | boolean                  | YES      | false             |                         |

### `ingestion_queue`

**Rows:** 2709

| Column                   | Type                     | Nullable | Default            | Constraints          |
| ------------------------ | ------------------------ | -------- | ------------------ | -------------------- |
| `id`                     | uuid                     | NO       | gen_random_uuid()  | PK                   |
| `url`                    | text                     | NO       |                    |                      |
| `url_norm`               | text                     | YES      |                    |                      |
| `content_hash`           | text                     | YES      |                    |                      |
| `content_type`           | text                     | YES      | 'resource'::text   |                      |
| `payload`                | jsonb                    | NO       |                    |                      |
| `payload_schema_version` | integer                  | NO       | 1                  |                      |
| `raw_ref`                | text                     | YES      |                    |                      |
| `thumb_ref`              | text                     | YES      |                    |                      |
| `etag`                   | text                     | YES      |                    |                      |
| `last_modified_at`       | timestamp with time zone | YES      |                    |                      |
| `discovered_at`          | timestamp with time zone | YES      | now()              |                      |
| `fetched_at`             | timestamp with time zone | YES      |                    |                      |
| `reviewed_at`            | timestamp with time zone | YES      |                    |                      |
| `reviewer`               | uuid                     | YES      |                    |                      |
| `rejection_reason`       | text                     | YES      |                    |                      |
| `prompt_version`         | text                     | YES      |                    |                      |
| `model_id`               | text                     | YES      |                    |                      |
| `agent_metadata`         | jsonb                    | YES      |                    |                      |
| `stg_id`                 | uuid                     | YES      |                    |                      |
| `approved_at`            | timestamp with time zone | YES      |                    |                      |
| `relevance_score`        | numeric                  | YES      |                    |                      |
| `executive_summary`      | text                     | YES      |                    |                      |
| `skip_reason`            | text                     | YES      |                    |                      |
| `status_code`            | smallint                 | NO       | 200                |                      |
| `entry_type`             | text                     | YES      | 'discovered'::text |                      |
| `reviewed_by`            | uuid                     | YES      |                    | FK → null.null       |
| `current_run_id`         | uuid                     | YES      |                    | FK → pipeline_run.id |
| `failure_count`          | integer                  | YES      | 0                  |                      |
| `last_failed_step`       | text                     | YES      |                    |                      |
| `last_error_message`     | text                     | YES      |                    |                      |
| `last_error_signature`   | text                     | YES      |                    |                      |
| `last_error_at`          | timestamp with time zone | YES      |                    |                      |
| `blocker`                | text                     | YES      |                    |                      |
| `blocker_details`        | jsonb                    | YES      |                    |                      |
| `updated_at`             | timestamp with time zone | NO       | now()              |                      |
| `idempotency_key`        | text                     | YES      |                    |                      |
| `retry_after`            | timestamp with time zone | YES      |                    |                      |
| `step_attempt`           | integer                  | YES      | 1                  |                      |
| `last_successful_step`   | text                     | YES      |                    |                      |
| `review_notes`           | text                     | YES      |                    |                      |
| `review_action`          | text                     | YES      |                    |                      |
| `mime`                   | text                     | YES      |                    |                      |
| `final_url`              | text                     | YES      |                    |                      |
| `original_url`           | text                     | YES      |                    |                      |
| `fetch_status`           | integer                  | YES      |                    |                      |
| `fetch_error`            | text                     | YES      |                    |                      |
| `expires_at`             | timestamp with time zone | YES      |                    |                      |
| `storage_deleted_at`     | timestamp with time zone | YES      |                    |                      |
| `deletion_reason`        | text                     | YES      |                    |                      |
| `oversize_bytes`         | bigint                   | YES      |                    |                      |

### `ingestion_queue_archive`

**Rows:** 0

| Column                   | Type                     | Nullable | Default | Constraints |
| ------------------------ | ------------------------ | -------- | ------- | ----------- |
| `id`                     | uuid                     | NO       |         | PK          |
| `url`                    | text                     | NO       |         |             |
| `url_norm`               | text                     | YES      |         |             |
| `content_hash`           | text                     | YES      |         |             |
| `status`                 | text                     | YES      |         |             |
| `status_code`            | smallint                 | YES      |         |             |
| `content_type`           | text                     | YES      |         |             |
| `entry_type`             | text                     | YES      |         |             |
| `payload`                | jsonb                    | NO       |         |             |
| `payload_schema_version` | integer                  | YES      |         |             |
| `raw_ref`                | text                     | YES      |         |             |
| `thumb_ref`              | text                     | YES      |         |             |
| `etag`                   | text                     | YES      |         |             |
| `last_modified_at`       | timestamp with time zone | YES      |         |             |
| `discovered_at`          | timestamp with time zone | YES      |         |             |
| `fetched_at`             | timestamp with time zone | YES      |         |             |
| `reviewed_at`            | timestamp with time zone | YES      |         |             |
| `approved_at`            | timestamp with time zone | YES      |         |             |
| `reviewer`               | uuid                     | YES      |         |             |
| `rejection_reason`       | text                     | YES      |         |             |
| `prompt_version`         | text                     | YES      |         |             |
| `model_id`               | text                     | YES      |         |             |
| `agent_metadata`         | jsonb                    | YES      |         |             |
| `archived_at`            | timestamp with time zone | YES      | now()   |             |

### `ingestion_queue_with_transitions`

**Rows:** 2709

| Column                          | Type                     | Nullable | Default | Constraints |
| ------------------------------- | ------------------------ | -------- | ------- | ----------- |
| `id`                            | uuid                     | YES      |         |             |
| `url`                           | text                     | YES      |         |             |
| `url_norm`                      | text                     | YES      |         |             |
| `content_hash`                  | text                     | YES      |         |             |
| `content_type`                  | text                     | YES      |         |             |
| `payload`                       | jsonb                    | YES      |         |             |
| `payload_schema_version`        | integer                  | YES      |         |             |
| `raw_ref`                       | text                     | YES      |         |             |
| `thumb_ref`                     | text                     | YES      |         |             |
| `etag`                          | text                     | YES      |         |             |
| `last_modified`                 | timestamp with time zone | YES      |         |             |
| `discovered_at`                 | timestamp with time zone | YES      |         |             |
| `fetched_at`                    | timestamp with time zone | YES      |         |             |
| `reviewed_at`                   | timestamp with time zone | YES      |         |             |
| `reviewer`                      | uuid                     | YES      |         |             |
| `rejection_reason`              | text                     | YES      |         |             |
| `prompt_version`                | text                     | YES      |         |             |
| `model_id`                      | text                     | YES      |         |             |
| `agent_metadata`                | jsonb                    | YES      |         |             |
| `stg_id`                        | uuid                     | YES      |         |             |
| `approved_at`                   | timestamp with time zone | YES      |         |             |
| `relevance_score`               | numeric                  | YES      |         |             |
| `executive_summary`             | text                     | YES      |         |             |
| `skip_reason`                   | text                     | YES      |         |             |
| `status_code`                   | smallint                 | YES      |         |             |
| `entry_type`                    | text                     | YES      |         |             |
| `reviewed_by`                   | uuid                     | YES      |         |             |
| `current_run_id`                | uuid                     | YES      |         |             |
| `failure_count`                 | integer                  | YES      |         |             |
| `last_failed_step`              | text                     | YES      |         |             |
| `last_error_message`            | text                     | YES      |         |             |
| `last_error_signature`          | text                     | YES      |         |             |
| `last_error_at`                 | timestamp with time zone | YES      |         |             |
| `blocker`                       | text                     | YES      |         |             |
| `blocker_details`               | jsonb                    | YES      |         |             |
| `status_name`                   | text                     | YES      |         |             |
| `status_category`               | text                     | YES      |         |             |
| `is_terminal`                   | boolean                  | YES      |         |             |
| `valid_next_states`             | ARRAY                    | YES      |         |             |
| `valid_next_states_with_manual` | ARRAY                    | YES      |         |             |

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

| Column        | Type    | Nullable | Default           | Constraints |
| ------------- | ------- | -------- | ----------------- | ----------- |
| `code`        | text    | NO       |                   | UNIQUE      |
| `name`        | text    | NO       |                   |             |
| `description` | text    | YES      |                   |             |
| `sort_order`  | integer | YES      | 100               |             |
| `id`          | uuid    | NO       | gen_random_uuid() | PK          |

### `kb_channel`

**Rows:** 7

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `code`        | text                     | NO       |                   | UNIQUE      |
| `name`        | text                     | NO       |                   |             |
| `description` | text                     | YES      |                   |             |
| `icon`        | text                     | YES      |                   |             |
| `sort_order`  | integer                  | YES      | 100               |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |

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

**Rows:** 147

| Column                 | Type                     | Nullable | Default           | Constraints             |
| ---------------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`                   | uuid                     | NO       | gen_random_uuid() | PK                      |
| `slug`                 | text                     | NO       |                   | UNIQUE                  |
| `title`                | text                     | NO       |                   |                         |
| `author`               | text                     | YES      |                   |                         |
| `published_at`         | timestamp with time zone | YES      |                   |                         |
| `added_at`             | timestamp with time zone | YES      | now()             |                         |
| `last_edited_at`       | timestamp with time zone | YES      | now()             |                         |
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
| `vendor_id`      | uuid    | NO       |         | FK → ag_vendor.id      |
| `vendor_id`      | uuid    | NO       |         | PK                     |
| `rank`           | integer | YES      | 0       |                        |

### `kb_publication_audience`

**Rows:** 178

| Column           | Type    | Nullable | Default | Constraints            |
| ---------------- | ------- | -------- | ------- | ---------------------- |
| `publication_id` | uuid    | NO       |         | FK → kb_publication.id |
| `publication_id` | uuid    | NO       |         | PK                     |
| `audience_code`  | text    | NO       |         | PK                     |
| `score`          | numeric | YES      | 0.0     |                        |

### `kb_publication_bfsi_industry`

**Rows:** 172

| Column           | Type    | Nullable | Default | Constraints            |
| ---------------- | ------- | -------- | ------- | ---------------------- |
| `publication_id` | uuid    | NO       |         | PK                     |
| `publication_id` | uuid    | NO       |         | FK → kb_publication.id |
| `industry_code`  | text    | NO       |         | PK                     |
| `rank`           | integer | YES      | 0       |                        |

### `kb_publication_bfsi_organization`

**Rows:** 2

| Column            | Type    | Nullable | Default | Constraints               |
| ----------------- | ------- | -------- | ------- | ------------------------- |
| `publication_id`  | uuid    | NO       |         | PK                        |
| `publication_id`  | uuid    | NO       |         | FK → kb_publication.id    |
| `organization_id` | uuid    | NO       |         | FK → bfsi_organization.id |
| `organization_id` | uuid    | NO       |         | PK                        |
| `rank`            | integer | YES      | 0       |                           |

### `kb_publication_bfsi_process`

**Rows:** 7

| Column           | Type                     | Nullable | Default | Constraints            |
| ---------------- | ------------------------ | -------- | ------- | ---------------------- |
| `process_code`   | text                     | NO       |         | FK → bfsi_process.code |
| `process_code`   | text                     | NO       |         | PK                     |
| `rank`           | integer                  | YES      | 0       |                        |
| `confidence`     | numeric                  | YES      |         |                        |
| `created_at`     | timestamp with time zone | YES      | now()   |                        |
| `publication_id` | uuid                     | NO       |         | PK                     |

### `kb_publication_bfsi_topic`

**Rows:** 1

| Column           | Type    | Nullable | Default | Constraints            |
| ---------------- | ------- | -------- | ------- | ---------------------- |
| `publication_id` | uuid    | NO       |         | PK                     |
| `publication_id` | uuid    | NO       |         | FK → kb_publication.id |
| `topic_code`     | text    | NO       |         | PK                     |
| `rank`           | integer | YES      | 0       |                        |

### `kb_publication_kb_topic`

**Rows:** 121

| Column           | Type    | Nullable | Default | Constraints            |
| ---------------- | ------- | -------- | ------- | ---------------------- |
| `publication_id` | uuid    | NO       |         | PK                     |
| `publication_id` | uuid    | NO       |         | FK → kb_publication.id |
| `topic_code`     | text    | NO       |         | PK                     |
| `rank`           | integer | YES      | 0       |                        |

### `kb_publication_obligation`

**Rows:** 0

| Column            | Type | Nullable | Default | Constraints            |
| ----------------- | ---- | -------- | ------- | ---------------------- |
| `publication_id`  | uuid | NO       |         | PK                     |
| `publication_id`  | uuid | NO       |         | FK → kb_publication.id |
| `obligation_code` | text | NO       |         | PK                     |
| `obligation_code` | text | NO       |         | FK → obligation.code   |

### `kb_publication_pretty`

**Rows:** 147

| Column             | Type                     | Nullable | Default | Constraints |
| ------------------ | ------------------------ | -------- | ------- | ----------- |
| `id`               | uuid                     | YES      |         |             |
| `slug`             | text                     | YES      |         |             |
| `title`            | text                     | YES      |         |             |
| `author`           | text                     | YES      |         |             |
| `published_at`     | timestamp with time zone | YES      |         |             |
| `added_at`         | timestamp with time zone | YES      |         |             |
| `last_edited_at`   | timestamp with time zone | YES      |         |             |
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
| `geography`        | text                     | YES      |         |             |
| `status`           | text                     | YES      |         |             |
| `origin_queue_id`  | uuid                     | YES      |         |             |
| `audience`         | text                     | YES      |         |             |
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
| `standard_id`    | bigint                   | NO       |         | FK → standard.id |
| `standard_id`    | bigint                   | NO       |         | PK               |
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
| `channel_code`          | text                     | YES      |                   | FK → kb_channel.code  |
| `disabled_reason`       | text                     | YES      |                   |                       |
| `primary_audience`      | text                     | YES      |                   | FK → kb_audience.code |
| `id`                    | uuid                     | NO       | gen_random_uuid() | UNIQUE                |

### `kb_topic`

**Rows:** 5

| Column        | Type                     | Nullable | Default           | Constraints             |
| ------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK                      |
| `code`        | text                     | NO       |                   | UNIQUE                  |
| `name`        | text                     | NO       |                   |                         |
| `level`       | integer                  | NO       |                   |                         |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → kb_topic.code      |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `parent_code` | text                     | YES      |                   | FK → bfsi_process.code  |
| `parent_code` | text                     | YES      |                   | FK → bfsi_industry.code |
| `sort_order`  | integer                  | YES      | 0                 |                         |
| `description` | text                     | YES      |                   |                         |
| `created_at`  | timestamp with time zone | YES      | now()             |                         |
| `updated_at`  | timestamp with time zone | YES      | now()             |                         |

### `missed_discovery`

**Rows:** 10

| Column                    | Type                     | Nullable | Default           | Constraints             |
| ------------------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`                      | uuid                     | NO       | gen_random_uuid() | PK                      |
| `url`                     | text                     | NO       |                   |                         |
| `url_norm`                | text                     | NO       |                   |                         |
| `submitter_name`          | text                     | YES      |                   |                         |
| `submitter_type`          | text                     | YES      |                   |                         |
| `submitter_audience`      | text                     | YES      |                   |                         |
| `submitter_channel`       | text                     | YES      |                   |                         |
| `submitted_at`            | timestamp with time zone | YES      | now()             |                         |
| `why_valuable`            | text                     | YES      |                   |                         |
| `submitter_urgency`       | text                     | YES      |                   |                         |
| `verbatim_comment`        | text                     | YES      |                   |                         |
| `suggested_audiences`     | ARRAY                    | YES      |                   |                         |
| `suggested_topics`        | ARRAY                    | YES      |                   |                         |
| `suggested_industries`    | ARRAY                    | YES      |                   |                         |
| `suggested_geographies`   | ARRAY                    | YES      |                   |                         |
| `source_domain`           | text                     | YES      |                   |                         |
| `source_type`             | text                     | YES      |                   |                         |
| `existing_source_slug`    | text                     | YES      |                   |                         |
| `miss_category`           | text                     | YES      |                   |                         |
| `miss_details`            | jsonb                    | YES      |                   |                         |
| `resolution_status`       | text                     | YES      | 'pending'::text   |                         |
| `resolution_action`       | text                     | YES      |                   |                         |
| `resolved_at`             | timestamp with time zone | YES      |                   |                         |
| `resolved_by`             | text                     | YES      |                   |                         |
| `improvement_suggestions` | jsonb                    | YES      |                   |                         |
| `contributed_to_source`   | uuid                     | YES      |                   | FK → kb_source.id       |
| `contributed_to_pattern`  | text                     | YES      |                   |                         |
| `days_late`               | integer                  | YES      |                   |                         |
| `retroactive_score`       | integer                  | YES      |                   |                         |
| `created_at`              | timestamp with time zone | YES      | now()             |                         |
| `updated_at`              | timestamp with time zone | YES      | now()             |                         |
| `queue_id`                | uuid                     | YES      |                   | FK → ingestion_queue.id |

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

**Rows:** 2

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

### `pipeline_definition`

**Rows:** 2

| Column        | Type                     | Nullable | Default           | Constraints |
| ------------- | ------------------------ | -------- | ----------------- | ----------- |
| `id`          | uuid                     | NO       | gen_random_uuid() | PK          |
| `name`        | text                     | NO       |                   | UNIQUE      |
| `description` | text                     | YES      |                   |             |
| `is_active`   | boolean                  | YES      | true              |             |
| `created_at`  | timestamp with time zone | YES      | now()             |             |
| `updated_at`  | timestamp with time zone | YES      | now()             |             |

### `pipeline_entry_rule`

**Rows:** 3

| Column             | Type     | Nullable | Default           | Constraints                 |
| ------------------ | -------- | -------- | ----------------- | --------------------------- |
| `id`               | uuid     | NO       | gen_random_uuid() | PK                          |
| `pipeline_id`      | uuid     | NO       |                   | FK → pipeline_definition.id |
| `from_status_code` | smallint | YES      |                   | UNIQUE                      |
| `from_status_code` | smallint | YES      |                   | FK → status_lookup.code     |
| `trigger_type`     | text     | NO       |                   | UNIQUE                      |
| `priority`         | integer  | YES      | 0                 |                             |
| `is_active`        | boolean  | YES      | true              |                             |

### `pipeline_execution`

**Rows:** 0

| Column              | Type                     | Nullable | Default           | Constraints                 |
| ------------------- | ------------------------ | -------- | ----------------- | --------------------------- |
| `id`                | uuid                     | NO       | gen_random_uuid() | PK                          |
| `queue_id`          | uuid                     | NO       |                   | FK → ingestion_queue.id     |
| `pipeline_id`       | uuid                     | NO       |                   | FK → pipeline_definition.id |
| `pipeline_run_id`   | uuid                     | YES      |                   | FK → pipeline_run.id        |
| `entry_status_code` | smallint                 | NO       |                   |                             |
| `trigger_type`      | text                     | NO       |                   |                             |
| `status`            | text                     | NO       | 'running'::text   |                             |
| `current_step`      | text                     | YES      |                   |                             |
| `started_at`        | timestamp with time zone | YES      | now()             |                             |
| `completed_at`      | timestamp with time zone | YES      |                   |                             |
| `exit_status_code`  | smallint                 | YES      |                   |                             |
| `error_message`     | text                     | YES      |                   |                             |
| `step_results`      | jsonb                    | YES      | '[]'::jsonb       |                             |

### `pipeline_exit_rule`

**Rows:** 3

| Column                | Type     | Nullable | Default           | Constraints                 |
| --------------------- | -------- | -------- | ----------------- | --------------------------- |
| `id`                  | uuid     | NO       | gen_random_uuid() | PK                          |
| `pipeline_id`         | uuid     | NO       |                   | FK → pipeline_definition.id |
| `pipeline_id`         | uuid     | NO       |                   | UNIQUE                      |
| `from_status_code`    | smallint | YES      |                   | UNIQUE                      |
| `from_status_code`    | smallint | YES      |                   | FK → status_lookup.code     |
| `exit_status_code`    | smallint | NO       |                   | FK → status_lookup.code     |
| `is_manual`           | boolean  | YES      | false             |                             |
| `failure_status_code` | smallint | YES      |                   | FK → status_lookup.code     |

### `pipeline_run`

**Rows:** 387

| Column               | Type                     | Nullable | Default           | Constraints             |
| -------------------- | ------------------------ | -------- | ----------------- | ----------------------- |
| `id`                 | uuid                     | NO       | gen_random_uuid() | PK                      |
| `queue_id`           | uuid                     | NO       |                   | FK → ingestion_queue.id |
| `trigger`            | text                     | NO       |                   |                         |
| `status`             | text                     | NO       | 'running'::text   |                         |
| `started_at`         | timestamp with time zone | NO       | now()             |                         |
| `completed_at`       | timestamp with time zone | YES      |                   |                         |
| `created_by`         | text                     | YES      |                   |                         |
| `llm_tokens_input`   | integer                  | YES      | 0                 |                         |
| `llm_tokens_output`  | integer                  | YES      | 0                 |                         |
| `embedding_tokens`   | integer                  | YES      | 0                 |                         |
| `estimated_cost_usd` | numeric                  | YES      |                   |                         |

### `pipeline_run_costs`

**Rows:** 254

| Column               | Type                     | Nullable | Default | Constraints |
| -------------------- | ------------------------ | -------- | ------- | ----------- |
| `id`                 | uuid                     | YES      |         |             |
| `queue_id`           | uuid                     | YES      |         |             |
| `trigger`            | text                     | YES      |         |             |
| `status`             | text                     | YES      |         |             |
| `started_at`         | timestamp with time zone | YES      |         |             |
| `completed_at`       | timestamp with time zone | YES      |         |             |
| `llm_tokens_input`   | integer                  | YES      |         |             |
| `llm_tokens_output`  | integer                  | YES      |         |             |
| `embedding_tokens`   | integer                  | YES      |         |             |
| `estimated_cost_usd` | numeric                  | YES      |         |             |
| `duration_seconds`   | numeric                  | YES      |         |             |

### `pipeline_step`

**Rows:** 8

| Column            | Type                     | Nullable | Default           | Constraints                 |
| ----------------- | ------------------------ | -------- | ----------------- | --------------------------- |
| `id`              | uuid                     | NO       | gen_random_uuid() | PK                          |
| `pipeline_id`     | uuid                     | NO       |                   | UNIQUE                      |
| `pipeline_id`     | uuid                     | NO       |                   | UNIQUE                      |
| `pipeline_id`     | uuid                     | NO       |                   | FK → pipeline_definition.id |
| `step_name`       | text                     | NO       |                   | UNIQUE                      |
| `step_name`       | text                     | NO       |                   | FK → step_registry.name     |
| `step_order`      | integer                  | NO       |                   | UNIQUE                      |
| `is_required`     | boolean                  | YES      | true              |                             |
| `timeout_seconds` | integer                  | YES      | 300               |                             |
| `skip_condition`  | jsonb                    | YES      |                   |                             |
| `on_success`      | text                     | YES      | 'next'::text      |                             |
| `on_failure`      | text                     | YES      | 'abort'::text     |                             |
| `created_at`      | timestamp with time zone | YES      | now()             |                             |

### `pipeline_step_run`

**Rows:** 806

| Column            | Type                     | Nullable | Default           | Constraints          |
| ----------------- | ------------------------ | -------- | ----------------- | -------------------- |
| `id`              | uuid                     | NO       | gen_random_uuid() | PK                   |
| `run_id`          | uuid                     | NO       |                   | UNIQUE               |
| `run_id`          | uuid                     | NO       |                   | FK → pipeline_run.id |
| `step_name`       | text                     | NO       |                   | UNIQUE               |
| `status`          | text                     | NO       | 'pending'::text   |                      |
| `attempt`         | integer                  | NO       | 1                 | UNIQUE               |
| `started_at`      | timestamp with time zone | YES      |                   |                      |
| `completed_at`    | timestamp with time zone | YES      |                   |                      |
| `input_snapshot`  | jsonb                    | YES      |                   |                      |
| `output`          | jsonb                    | YES      |                   |                      |
| `error_message`   | text                     | YES      |                   |                      |
| `error_signature` | text                     | YES      |                   |                      |
| `idempotency_key` | text                     | YES      |                   |                      |

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

**Rows:** 1

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

**Rows:** 21

| Column              | Type                     | Nullable | Default           | Constraints      |
| ------------------- | ------------------------ | -------- | ----------------- | ---------------- |
| `version`           | text                     | NO       |                   | UNIQUE           |
| `prompt_text`       | text                     | YES      |                   |                  |
| `created_at`        | timestamp with time zone | YES      | now()             |                  |
| `rejection_rate`    | numeric                  | YES      |                   |                  |
| `avg_quality_score` | numeric                  | YES      |                   |                  |
| `notes`             | text                     | YES      |                   |                  |
| `agent_name`        | text                     | YES      |                   | UNIQUE           |
| `stage`             | text                     | YES      |                   |                  |
| `model_id`          | text                     | YES      |                   |                  |
| `id`                | uuid                     | NO       | gen_random_uuid() | PK               |
| `created_by`        | uuid                     | YES      |                   | FK → null.null   |
| `last_eval_run_id`  | uuid                     | YES      |                   | FK → eval_run.id |
| `last_eval_score`   | numeric                  | YES      |                   |                  |
| `last_eval_status`  | text                     | YES      |                   |                  |
| `last_eval_at`      | timestamp with time zone | YES      |                   |                  |
| `max_tokens`        | integer                  | YES      | 4096              |                  |
| `deployed_at`       | timestamp with time zone | YES      |                   |                  |
| `retired_at`        | timestamp with time zone | YES      |                   |                  |

### `proposed_entity`

**Rows:** 2

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

### `raw_object`

**Rows:** 662

| Column           | Type                     | Nullable | Default | Constraints |
| ---------------- | ------------------------ | -------- | ------- | ----------- |
| `content_hash`   | text                     | NO       |         | PK          |
| `raw_ref`        | text                     | NO       |         |             |
| `first_seen_at`  | timestamp with time zone | NO       | now()   |             |
| `mime_detected`  | text                     | YES      |         |             |
| `bytes`          | bigint                   | YES      |         |             |
| `raw_store_mode` | text                     | YES      |         |             |

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

| Column            | Type                     | Nullable | Default           | Constraints       |
| ----------------- | ------------------------ | -------- | ----------------- | ----------------- |
| `code`            | text                     | YES      |                   | UNIQUE            |
| `title`           | text                     | NO       |                   |                   |
| `instrument_type` | text                     | YES      |                   |                   |
| `jurisdiction`    | text                     | YES      |                   |                   |
| `scope_goals`     | text                     | YES      |                   |                   |
| `status`          | text                     | YES      |                   |                   |
| `effective_from`  | date                     | YES      |                   |                   |
| `effective_to`    | date                     | YES      |                   |                   |
| `obligations`     | jsonb                    | YES      |                   |                   |
| `deadlines`       | jsonb                    | YES      |                   |                   |
| `sources`         | jsonb                    | YES      |                   |                   |
| `notes`           | text                     | YES      |                   |                   |
| `created_at`      | timestamp with time zone | YES      | now()             |                   |
| `updated_at`      | timestamp with time zone | YES      | now()             |                   |
| `domain`          | text                     | YES      |                   |                   |
| `regulator_id`    | uuid                     | YES      |                   | FK → regulator.id |
| `id`              | uuid                     | NO       | gen_random_uuid() | PK                |

### `regulation_obligations_pretty`

**Rows:** 46

| Column           | Type | Nullable | Default | Constraints |
| ---------------- | ---- | -------- | ------- | ----------- |
| `id`             | uuid | YES      |         |             |
| `code`           | text | YES      |         |             |
| `title`          | text | YES      |         |             |
| `obligation`     | text | YES      |         |             |
| `domain`         | text | YES      |         |             |
| `regulator_name` | text | YES      |         |             |

### `regulation_pretty`

**Rows:** 18

| Column                   | Type                     | Nullable | Default | Constraints |
| ------------------------ | ------------------------ | -------- | ------- | ----------- |
| `id`                     | uuid                     | YES      |         |             |
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
| `regulator_id`           | uuid                     | YES      |         |             |
| `regulator_slug`         | text                     | YES      |         |             |
| `regulator_website_url`  | text                     | YES      |         |             |
| `regulator_jurisdiction` | text                     | YES      |         |             |
| `domain`                 | text                     | YES      |         |             |

### `regulator`

**Rows:** 22

| Column         | Type                     | Nullable | Default | Constraints |
| -------------- | ------------------------ | -------- | ------- | ----------- |
| `name`         | text                     | NO       |         |             |
| `slug`         | text                     | NO       |         | UNIQUE      |
| `website_url`  | text                     | YES      |         |             |
| `jurisdiction` | text                     | YES      |         |             |
| `notes`        | text                     | YES      |         |             |
| `created_at`   | timestamp with time zone | NO       | now()   |             |
| `updated_at`   | timestamp with time zone | NO       | now()   |             |
| `domain`       | text                     | YES      |         |             |
| `id`           | uuid                     | NO       |         | PK          |

### `regulator_pretty`

**Rows:** 22

| Column         | Type | Nullable | Default | Constraints |
| -------------- | ---- | -------- | ------- | ----------- |
| `id`           | uuid | YES      |         |             |
| `name`         | text | YES      |         |             |
| `slug`         | text | YES      |         |             |
| `jurisdiction` | text | YES      |         |             |
| `website_url`  | text | YES      |         |             |

### `rejection_analytics`

**Rows:** 1

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

### `retry_policy`

**Rows:** 5

| Column               | Type                     | Nullable | Default | Constraints |
| -------------------- | ------------------------ | -------- | ------- | ----------- |
| `step_name`          | text                     | NO       |         | PK          |
| `max_attempts`       | integer                  | NO       | 3       |             |
| `base_delay_seconds` | integer                  | NO       | 60      |             |
| `backoff_multiplier` | numeric                  | NO       | 2.0     |             |
| `created_at`         | timestamp with time zone | YES      | now()   |             |
| `updated_at`         | timestamp with time zone | YES      | now()   |             |

### `retry_queue_ready`

**Rows:** 0

| Column                   | Type                     | Nullable | Default | Constraints |
| ------------------------ | ------------------------ | -------- | ------- | ----------- |
| `id`                     | uuid                     | YES      |         |             |
| `url`                    | text                     | YES      |         |             |
| `url_norm`               | text                     | YES      |         |             |
| `content_hash`           | text                     | YES      |         |             |
| `content_type`           | text                     | YES      |         |             |
| `payload`                | jsonb                    | YES      |         |             |
| `payload_schema_version` | integer                  | YES      |         |             |
| `raw_ref`                | text                     | YES      |         |             |
| `thumb_ref`              | text                     | YES      |         |             |
| `etag`                   | text                     | YES      |         |             |
| `last_modified_at`       | timestamp with time zone | YES      |         |             |
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
| `reviewed_by`            | uuid                     | YES      |         |             |
| `current_run_id`         | uuid                     | YES      |         |             |
| `failure_count`          | integer                  | YES      |         |             |
| `last_failed_step`       | text                     | YES      |         |             |
| `last_error_message`     | text                     | YES      |         |             |
| `last_error_signature`   | text                     | YES      |         |             |
| `last_error_at`          | timestamp with time zone | YES      |         |             |
| `blocker`                | text                     | YES      |         |             |
| `blocker_details`        | jsonb                    | YES      |         |             |
| `updated_at`             | timestamp with time zone | YES      |         |             |
| `idempotency_key`        | text                     | YES      |         |             |
| `retry_after`            | timestamp with time zone | YES      |         |             |
| `step_attempt`           | integer                  | YES      |         |             |
| `last_successful_step`   | text                     | YES      |         |             |
| `review_notes`           | text                     | YES      |         |             |
| `review_action`          | text                     | YES      |         |             |
| `status_name`            | text                     | YES      |         |             |

### `review_queue_ready`

**Rows:** 149

| Column                   | Type    | Nullable | Default | Constraints |
| ------------------------ | ------- | -------- | ------- | ----------- |
| `id`                     | uuid    | YES      |         |             |
| `url`                    | text    | YES      |         |             |
| `url_norm`               | text    | YES      |         |             |
| `content_hash`           | text    | YES      |         |             |
| `content_type`           | text    | YES      |         |             |
| `payload`                | jsonb   | YES      |         |             |
| `payload_schema_version` | integer | YES      |         |             |
| `raw_ref`                | text    | YES      |         |             |
