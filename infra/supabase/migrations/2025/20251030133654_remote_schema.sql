


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "app";


ALTER SCHEMA "app" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "stg";


ALTER SCHEMA "stg" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "app"."current_uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select auth.uid() $$;


ALTER FUNCTION "app"."current_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."jwt_sub"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$ select current_setting('request.jwt.claim.sub', true) $$;


ALTER FUNCTION "app"."jwt_sub"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_taxo_get_or_create"("_level" integer, "_parent_id" bigint, "_name" "text") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE _id bigint;
BEGIN
  SELECT id INTO _id
  FROM ag_process_taxonomy
  WHERE level = _level
    AND parent_id IS NOT DISTINCT FROM _parent_id
    AND name = _name;

  IF _id IS NULL THEN
    INSERT INTO ag_process_taxonomy(level, parent_id, name)
    VALUES (_level, _parent_id, _name)
    RETURNING id INTO _id;
  END IF;

  RETURN _id;
END;
$$;


ALTER FUNCTION "public"."ag_taxo_get_or_create"("_level" integer, "_parent_id" bigint, "_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_taxonomy_merge_from_staging"("p_batch_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_batch uuid := COALESCE(p_batch_id, (
    SELECT batch_id FROM ag_process_taxonomy_stg ORDER BY loaded_at DESC LIMIT 1
  ));
  rec record;
  v0 bigint; v1 bigint; v2 bigint; v3 bigint; v4 bigint;
  v_op text;
BEGIN
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'No staging batch found';
  END IF;

  FOR rec IN
    SELECT row_no, l0, l1, l2, l3, l4, COALESCE(NULLIF(op,''),'UPSERT') AS op
    FROM ag_process_taxonomy_stg
    WHERE batch_id = v_batch
    ORDER BY row_no NULLS FIRST, l0, l1, l2, l3, l4
  LOOP
    v_op := upper(rec.op);

    -- L0
    IF rec.l0 IS NULL THEN
      RAISE EXCEPTION 'l0 (domain) is required for row %', rec.row_no;
    END IF;
    v0 := ag_taxo_get_or_create(0, NULL, rec.l0);

    -- L1
    v1 := CASE WHEN rec.l1 IS NOT NULL THEN ag_taxo_get_or_create(1, v0, rec.l1) END;

    -- L2
    v2 := CASE WHEN rec.l2 IS NOT NULL THEN ag_taxo_get_or_create(2, v1, rec.l2) END;

    -- L3
    v3 := CASE WHEN rec.l3 IS NOT NULL THEN ag_taxo_get_or_create(3, v2, rec.l3) END;

    -- L4
    v4 := CASE WHEN rec.l4 IS NOT NULL THEN ag_taxo_get_or_create(4, v3, rec.l4) END;

    -- Optional: deactivate handling
    IF v_op = 'DEACTIVATE' THEN
      NULL; -- future hook
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."ag_taxonomy_merge_from_staging"("p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_use_case_taxo_autofill"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- If only L4 is given, backfill L3
  IF NEW.l4_id IS NOT NULL AND NEW.l3_id IS NULL THEN
    SELECT parent_id INTO NEW.l3_id FROM ag_process_taxonomy WHERE id = NEW.l4_id;
  END IF;

  -- If L3 is set but L2 is NULL, backfill L2
  IF NEW.l3_id IS NOT NULL AND NEW.l2_id IS NULL THEN
    SELECT parent_id INTO NEW.l2_id FROM ag_process_taxonomy WHERE id = NEW.l3_id;
  END IF;

  -- If L2 is set but L1 is NULL, backfill L1
  IF NEW.l2_id IS NOT NULL AND NEW.l1_id IS NULL THEN
    SELECT parent_id INTO NEW.l1_id FROM ag_process_taxonomy WHERE id = NEW.l2_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ag_use_case_taxo_autofill"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_vendor_merge_all_from_staging"("clear_after" boolean DEFAULT true) RETURNS TABLE("action" "text", "cnt" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE v_inserted int := 0;
DECLARE v_updated  int := 0;
BEGIN
  WITH up AS (
    INSERT INTO ag_vendor (
      name, website, hq_country, regions_served, founded_year,
      ownership_type, headcount_range, funding_stage, parent_entity,
      deployment, certifications, data_coverage, pricing_model, notes, aliases,
      created_at, updated_at, created_by
    )
    SELECT
      s.name,
      s.website,
      s.hq_country,
      s.regions_served,
      NULLIF(s.founded_year,'')::integer,
      s.ownership_type,
      s.headcount_range,
      s.funding_stage,
      s.parent_entity,
      s.deployment,
      s.certifications,
      s.data_coverage,
      s.pricing_model,
      s.notes,
      s.aliases,
      now(), now(), NULL
    FROM ag_vendor_stg s
    WHERE COALESCE(s.op,'UPSERT') = 'UPSERT'
    ON CONFLICT ((lower(btrim(name))))     -- <- normalized key
    DO UPDATE SET
      website         = EXCLUDED.website,
      hq_country      = EXCLUDED.hq_country,
      regions_served  = EXCLUDED.regions_served,
      founded_year    = EXCLUDED.founded_year,
      ownership_type  = EXCLUDED.ownership_type,
      headcount_range = EXCLUDED.headcount_range,
      funding_stage   = EXCLUDED.funding_stage,
      parent_entity   = EXCLUDED.parent_entity,
      deployment      = EXCLUDED.deployment,
      certifications  = EXCLUDED.certifications,
      data_coverage   = EXCLUDED.data_coverage,
      pricing_model   = EXCLUDED.pricing_model,
      notes           = EXCLUDED.notes,
      aliases         = EXCLUDED.aliases,
      updated_at      = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COALESCE(SUM(CASE WHEN inserted THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN NOT inserted THEN 1 ELSE 0 END),0)
  INTO v_inserted, v_updated
  FROM up;

  -- Soft-deactivate support (optional)
  UPDATE ag_vendor v
  SET notes = CONCAT(COALESCE(v.notes,''), CASE WHEN v.notes IS NULL OR v.notes = '' THEN '' ELSE ' ' END, '[DEACTIVATED]'),
      updated_at = now()
  FROM ag_vendor_stg s
  WHERE COALESCE(s.op,'UPSERT') = 'DEACTIVATE'
    AND lower(btrim(s.name)) = lower(btrim(v.name));

  RETURN QUERY SELECT 'inserted', v_inserted;
  RETURN QUERY SELECT 'updated',  v_updated;

  IF clear_after THEN
    TRUNCATE TABLE ag_vendor_stg;
  END IF;
END;
$$;


ALTER FUNCTION "public"."ag_vendor_merge_all_from_staging"("clear_after" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_vendor_merge_from_staging"("_batch" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- Upsert rows
  INSERT INTO ag_vendor (
    name, website, hq_country, regions_served, founded_year,
    ownership_type, headcount_range, funding_stage, parent_entity,
    deployment, certifications, data_coverage, pricing_model, notes, aliases,
    created_at, updated_at, created_by
  )
  SELECT
    s.name, s.website, s.hq_country, s.regions_served, NULLIF(s.founded_year, '')::integer,
    s.ownership_type, s.headcount_range, s.funding_stage, s.parent_entity,
    s.deployment, s.certifications, s.data_coverage, s.pricing_model, s.notes, s.aliases,
    now(), now(), NULL
  FROM ag_vendor_stg s
  WHERE s.batch_id = _batch
    AND COALESCE(s.op,'UPSERT') = 'UPSERT'
  ON CONFLICT (name)
  DO UPDATE
    SET website         = EXCLUDED.website,
        hq_country      = EXCLUDED.hq_country,
        regions_served  = EXCLUDED.regions_served,
        founded_year    = EXCLUDED.founded_year,
        ownership_type  = EXCLUDED.ownership_type,
        headcount_range = EXCLUDED.headcount_range,
        funding_stage   = EXCLUDED.funding_stage,
        parent_entity   = EXCLUDED.parent_entity,
        deployment      = EXCLUDED.deployment,
        certifications  = EXCLUDED.certifications,
        data_coverage   = EXCLUDED.data_coverage,
        pricing_model   = EXCLUDED.pricing_model,
        notes           = EXCLUDED.notes,
        aliases         = EXCLUDED.aliases,
        updated_at      = now();

  -- Optionally: deactivate rows
  UPDATE ag_vendor v
  SET notes = COALESCE(v.notes,'') || ' [DEACTIVATED]',
      updated_at = now()
  FROM ag_vendor_stg s
  WHERE s.batch_id = _batch
    AND s.op = 'DEACTIVATE'
    AND v.name = s.name;
END;
$$;


ALTER FUNCTION "public"."ag_vendor_merge_from_staging"("_batch" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_vendor_merge_from_staging_return"("_batch" "uuid") RETURNS TABLE("action" "text", "cnt" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE v_inserted int := 0;
DECLARE v_updated  int := 0;
BEGIN
  WITH up AS (
    INSERT INTO ag_vendor (
      name, website, hq_country, regions_served, founded_year,
      ownership_type, headcount_range, funding_stage, parent_entity,
      deployment, certifications, data_coverage, pricing_model, notes, aliases,
      created_at, updated_at, created_by
    )
    SELECT
      s.name,
      s.website,
      s.hq_country,
      s.regions_served,
      NULLIF(s.founded_year,'')::integer,
      s.ownership_type,
      s.headcount_range,
      s.funding_stage,
      s.parent_entity,
      s.deployment,
      s.certifications,
      s.data_coverage,
      s.pricing_model,
      s.notes,
      s.aliases,
      now(), now(), NULL
    FROM ag_vendor_stg s
    WHERE s.batch_id = _batch
      AND COALESCE(s.op,'UPSERT') = 'UPSERT'
    ON CONFLICT (lower(trim(name)))     -- uses the normalized unique index
    DO UPDATE SET
      website         = EXCLUDED.website,
      hq_country      = EXCLUDED.hq_country,
      regions_served  = EXCLUDED.regions_served,
      founded_year    = EXCLUDED.founded_year,
      ownership_type  = EXCLUDED.ownership_type,
      headcount_range = EXCLUDED.headcount_range,
      funding_stage   = EXCLUDED.funding_stage,
      parent_entity   = EXCLUDED.parent_entity,
      deployment      = EXCLUDED.deployment,
      certifications  = EXCLUDED.certifications,
      data_coverage   = EXCLUDED.data_coverage,
      pricing_model   = EXCLUDED.pricing_model,
      notes           = EXCLUDED.notes,
      aliases         = EXCLUDED.aliases,
      updated_at      = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    SUM(CASE WHEN inserted THEN 1 ELSE 0 END),
    SUM(CASE WHEN NOT inserted THEN 1 ELSE 0 END)
  INTO v_inserted, v_updated
  FROM up;

  RETURN QUERY SELECT 'inserted', COALESCE(v_inserted,0);
  RETURN QUERY SELECT 'updated',  COALESCE(v_updated,0);
END;
$$;


ALTER FUNCTION "public"."ag_vendor_merge_from_staging_return"("_batch" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_vendor_upsert_from_stg"() RETURNS TABLE("updated" integer, "inserted" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  WITH stg_dedup AS (
    SELECT *
    FROM (
      SELECT s.*,
             lower(trim(s.name)) AS name_key,
             row_number() OVER (
               PARTITION BY lower(trim(s.name))
               ORDER BY s.loaded_at DESC NULLS LAST, s.row_no DESC
             ) AS rn
      FROM ag_vendor_stg s
      WHERE COALESCE(s.op, 'UPSERT') = 'UPSERT'
        AND NULLIF(s.name,'') IS NOT NULL
    ) x WHERE rn = 1
  ),
  up AS (
    UPDATE ag_vendor v
       SET website         = COALESCE(NULLIF(sd.website,''), v.website),
           hq_country      = COALESCE(NULLIF(sd.hq_country,''), v.hq_country),
           regions_served  = CASE WHEN sd.regions_served IS NOT NULL AND array_length(sd.regions_served,1) IS NOT NULL THEN sd.regions_served ELSE v.regions_served END,
           founded_year    = COALESCE(NULLIF(sd.founded_year,'')::int, v.founded_year),
           ownership_type  = COALESCE(NULLIF(sd.ownership_type,''), v.ownership_type),
           headcount_range = COALESCE(NULLIF(sd.headcount_range,''), v.headcount_range),
           funding_stage   = COALESCE(NULLIF(sd.funding_stage,''), v.funding_stage),
           parent_entity   = COALESCE(NULLIF(sd.parent_entity,''), v.parent_entity),
           deployment      = CASE WHEN sd.deployment IS NOT NULL AND array_length(sd.deployment,1) IS NOT NULL THEN sd.deployment ELSE v.deployment END,
           certifications  = CASE WHEN sd.certifications IS NOT NULL AND array_length(sd.certifications,1) IS NOT NULL THEN sd.certifications ELSE v.certifications END,
           data_coverage   = CASE WHEN sd.data_coverage IS NOT NULL AND sd.data_coverage <> '{}'::jsonb THEN sd.data_coverage ELSE v.data_coverage END,
           pricing_model   = COALESCE(NULLIF(sd.pricing_model,''), v.pricing_model),
           notes           = COALESCE(NULLIF(sd.notes,''), v.notes),
           aliases         = CASE WHEN sd.aliases IS NOT NULL AND array_length(sd.aliases,1) IS NOT NULL THEN sd.aliases ELSE v.aliases END,
           updated_at      = now()
      FROM stg_dedup sd
     WHERE lower(trim(v.name)) = sd.name_key
     RETURNING 1
  ),
  ins AS (
    INSERT INTO ag_vendor (
      created_at, name, updated_at, created_by,
      aliases, website, hq_country, regions_served, founded_year,
      ownership_type, headcount_range, funding_stage, parent_entity,
      deployment, certifications, data_coverage, pricing_model, notes
    )
    SELECT
      now(), sd.name, now(), NULL,
      CASE WHEN sd.aliases IS NOT NULL AND array_length(sd.aliases,1) IS NOT NULL THEN sd.aliases ELSE NULL END,
      NULLIF(sd.website,''), NULLIF(sd.hq_country,''),
      CASE WHEN sd.regions_served IS NOT NULL AND array_length(sd.regions_served,1) IS NOT NULL THEN sd.regions_served ELSE NULL END,
      NULLIF(sd.founded_year,'')::int,
      NULLIF(sd.ownership_type,''), NULLIF(sd.headcount_range,''), NULLIF(sd.funding_stage,''), NULLIF(sd.parent_entity,''),
      CASE WHEN sd.deployment IS NOT NULL AND array_length(sd.deployment,1) IS NOT NULL THEN sd.deployment ELSE NULL END,
      CASE WHEN sd.certifications IS NOT NULL AND array_length(sd.certifications,1) IS NOT NULL THEN sd.certifications ELSE NULL END,
      CASE WHEN sd.data_coverage IS NOT NULL AND sd.data_coverage <> '{}'::jsonb THEN sd.data_coverage ELSE NULL END,
      NULLIF(sd.pricing_model,''), NULLIF(sd.notes,'')
    FROM stg_dedup sd
    WHERE NOT EXISTS (SELECT 1 FROM ag_vendor v WHERE lower(trim(v.name)) = sd.name_key)
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM up), (SELECT count(*) FROM ins)
  INTO updated, inserted;

  RETURN NEXT;
END $$;


ALTER FUNCTION "public"."ag_vendor_upsert_from_stg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_log_ag_use_case_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO ag_use_case_audit
    (id, changed_at, changed_by,
     old_reach, old_impact, old_confidence, old_ease, old_rice,
     new_reach, new_impact, new_confidence, new_ease, new_rice)
  VALUES
    (NEW.id, now(), current_user,
     OLD.reach, OLD.impact, OLD.confidence, OLD.ease,
     (OLD.reach * OLD.impact * OLD.confidence * OLD.ease),
     NEW.reach, NEW.impact, NEW.confidence, NEW.ease,
     (NEW.reach * NEW.impact * NEW.confidence * NEW.ease));
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."fn_log_ag_use_case_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_log_ag_use_case_rice_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.ag_use_case_score_audit
    (id, old_reach, old_impact, old_confidence, old_ease, old_rice,
         new_reach, new_impact, new_confidence, new_ease, new_rice)
  VALUES
    (NEW.id,
     OLD.reach, OLD.impact, OLD.confidence, OLD.ease,
     (OLD.reach * OLD.impact * OLD.confidence * OLD.ease),
     NEW.reach, NEW.impact, NEW.confidence, NEW.ease,
     (NEW.reach * NEW.impact * NEW.confidence * NEW.ease));
  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."fn_log_ag_use_case_rice_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_text_to_jsonb"("t" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare a text[]; v text; out jsonb := '[]'::jsonb;
begin
  if t is null or btrim(t) = '' then return null; end if;
  a := public.list_text_to_textarray(t);
  if a is null then return null; end if;
  foreach v in array a loop out := out || to_jsonb(v); end loop;
  return out;
end;
$$;


ALTER FUNCTION "public"."list_text_to_jsonb"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_text_to_textarray"("t" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare cleaned text; parts text[]; out_arr text[]; v text;
begin
  if t is null or btrim(t) = '' then return null; end if;
  cleaned := regexp_replace(regexp_replace(public.normalize_text(t),'^\[|\]$','','g'), '"','','g');
  parts := regexp_split_to_array(cleaned, ',');
  out_arr := array[]::text[];
  foreach v in array parts loop
    v := btrim(v);
    if v <> '' then out_arr := out_arr || v; end if;
  end loop;
  if out_arr = '{}'::text[] then return null; else return out_arr; end if;
end;
$_$;


ALTER FUNCTION "public"."list_text_to_textarray"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_text"("t" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select nullif(
    regexp_replace(
      translate(coalesce(t,''),
        '’‘“”–—•',  '''''"- -'),
      '\s+', ' ', 'g'
    )::text, ''
  );
$$;


ALTER FUNCTION "public"."normalize_text"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  -- remove or comment out this line to stop pop-ups
  -- RAISE NOTICE 'Updating column updated_at from %', TG_TABLE_NAME;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_vendor"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin new.updated_at := now(); return new; end $$;


ALTER FUNCTION "public"."set_updated_at_vendor"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ag_use_case" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "persona" "text",
    "problem_need" "text",
    "agent_action" "text",
    "outcome_deliverable" "text",
    "risk_control_notes" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tags" "text"[],
    "bfsi_industry_taxonomy_id" integer,
    "bfsi_process_taxonomy_id" "text",
    "reach" integer,
    "impact" integer,
    "confidence" integer,
    "ease" integer,
    "rice_score" integer GENERATED ALWAYS AS (((("reach" * "impact") * "confidence") * "ease")) STORED,
    "name_ci" "text" GENERATED ALWAYS AS ("lower"("btrim"("name"))) STORED,
    "code" "text" NOT NULL,
    CONSTRAINT "ag_use_case_code_chk" CHECK (("code" ~ '^UC\d{3,}$'::"text")),
    CONSTRAINT "ag_use_case_confidence_check" CHECK ((("confidence" >= 1) AND ("confidence" <= 5))),
    CONSTRAINT "ag_use_case_ease_check" CHECK ((("ease" >= 1) AND ("ease" <= 5))),
    CONSTRAINT "ag_use_case_impact_check" CHECK ((("impact" >= 1) AND ("impact" <= 5))),
    CONSTRAINT "ag_use_case_reach_check" CHECK ((("reach" >= 1) AND ("reach" <= 5))),
    CONSTRAINT "ag_use_case_status_chk" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['draft'::"text", 'proposed'::"text", 'active'::"text", 'paused'::"text", 'done'::"text", 'archived'::"text"]))))
);


ALTER TABLE "public"."ag_use_case" OWNER TO "postgres";


COMMENT ON TABLE "public"."ag_use_case" IS 'Agentic AI use cases for risk & compliance in BFSI in the Netherlands';



ALTER TABLE "public"."ag_use_case" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."AG - Use-Case_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ag_capability" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "tags" "text"[],
    "ag_use_case_ids" bigint[] DEFAULT '{}'::bigint[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ag_capability_code_chk" CHECK (("code" ~ '^CAP\d{3,}$'::"text"))
);

ALTER TABLE ONLY "public"."ag_capability" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_capability" OWNER TO "postgres";


ALTER TABLE "public"."ag_capability" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ag_capability_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ag_use_case_capability" (
    "use_case_id" bigint NOT NULL,
    "capability_id" bigint NOT NULL,
    "relation_type" "text" DEFAULT 'required'::"text" NOT NULL,
    "weight" numeric(5,2),
    "rationale" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."ag_use_case_capability" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_use_case_capability" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ag_capability_pretty" WITH ("security_invoker"='true') AS
 WITH "uc" AS (
         SELECT "c"."id",
            "c"."code",
            "c"."name",
            "array_agg"(DISTINCT "u"."name" ORDER BY "u"."name") AS "names_arr",
            "array_agg"(DISTINCT "u"."code" ORDER BY "u"."code") AS "codes_arr"
           FROM (("public"."ag_capability" "c"
             LEFT JOIN "public"."ag_use_case_capability" "l" ON (("l"."capability_id" = "c"."id")))
             LEFT JOIN "public"."ag_use_case" "u" ON (("u"."id" = "l"."use_case_id")))
          GROUP BY "c"."id", "c"."code", "c"."name"
        )
 SELECT "id",
    "code" AS "Capability Code",
    "name" AS "Capability Name",
    "array_to_string"("codes_arr", ', '::"text") AS "Use Case Codes",
        CASE
            WHEN ("array_length"("names_arr", 1) <= 8) THEN "array_to_string"("names_arr", ' • '::"text")
            ELSE ((("array_to_string"("names_arr"[1:8], ' • '::"text") || ' … (+'::"text") || (("array_length"("names_arr", 1) - 8))::"text") || ' more)'::"text")
        END AS "Use Case Names",
    (COALESCE("array_length"("names_arr", 1), 0))::bigint AS "Use Case Count"
   FROM "uc"
  ORDER BY ((COALESCE("array_length"("names_arr", 1), 0))::bigint) DESC, "name";


ALTER VIEW "public"."ag_capability_pretty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_use_case_audit" (
    "audit_id" bigint NOT NULL,
    "id" integer NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "text" DEFAULT CURRENT_USER NOT NULL,
    "old_reach" integer,
    "old_impact" integer,
    "old_confidence" integer,
    "old_ease" integer,
    "old_rice" integer,
    "new_reach" integer,
    "new_impact" integer,
    "new_confidence" integer,
    "new_ease" integer,
    "new_rice" integer
);


ALTER TABLE "public"."ag_use_case_audit" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ag_use_case_capability_pretty" WITH ("security_invoker"='true') AS
 SELECT "l"."use_case_id" AS "Use Case ID",
    "u"."code" AS "Use Case Code",
    "u"."name" AS "Use Case",
    "l"."capability_id" AS "Capability ID",
    "c"."code" AS "Capability Code",
    "c"."name" AS "Capability Name",
    "l"."relation_type" AS "Relation Type",
    "l"."weight" AS "Weight",
    "l"."rationale" AS "Rationale",
    "to_char"("l"."created_at", 'YYYY-MM-DD'::"text") AS "Link Created",
    "to_char"("l"."updated_at", 'YYYY-MM-DD'::"text") AS "Link Updated"
   FROM (("public"."ag_use_case_capability" "l"
     JOIN "public"."ag_use_case" "u" ON (("u"."id" = "l"."use_case_id")))
     JOIN "public"."ag_capability" "c" ON (("c"."id" = "l"."capability_id")))
  ORDER BY "u"."code", "c"."code";


ALTER VIEW "public"."ag_use_case_capability_pretty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bfsi_process_taxonomy" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "level" integer NOT NULL,
    "parent_id" "text",
    CONSTRAINT "bfsi_process_taxonomy_level_check" CHECK (("level" = ANY (ARRAY[0, 1, 2, 3])))
);


ALTER TABLE "public"."bfsi_process_taxonomy" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ag_use_case_pretty" WITH ("security_invoker"='true') AS
 WITH RECURSIVE "process_path" AS (
         SELECT "bfsi_process_taxonomy"."id",
            "bfsi_process_taxonomy"."name",
            "bfsi_process_taxonomy"."parent_id",
            "bfsi_process_taxonomy"."name" AS "full_path"
           FROM "public"."bfsi_process_taxonomy"
          WHERE ("bfsi_process_taxonomy"."parent_id" IS NULL)
        UNION ALL
         SELECT "c"."id",
            "c"."name",
            "c"."parent_id",
            (("p"."full_path" || ' › '::"text") || "c"."name") AS "full_path"
           FROM ("public"."bfsi_process_taxonomy" "c"
             JOIN "process_path" "p" ON (("c"."parent_id" = "p"."id")))
        ), "cap" AS (
         SELECT "l"."use_case_id",
            "array_agg"(DISTINCT "c"."code" ORDER BY "c"."code") AS "cap_codes",
            "array_agg"(DISTINCT "c"."name" ORDER BY "c"."name") AS "cap_names",
            "array_agg"(DISTINCT "l"."relation_type" ORDER BY "l"."relation_type") AS "relation_types",
            "count"(DISTINCT "c"."id") AS "cap_count"
           FROM ("public"."ag_use_case_capability" "l"
             JOIN "public"."ag_capability" "c" ON (("c"."id" = "l"."capability_id")))
          GROUP BY "l"."use_case_id"
        )
 SELECT "u"."id",
    "u"."code" AS "Use Case Code",
    "u"."name" AS "Use Case",
    "u"."persona" AS "Persona",
    "u"."problem_need" AS "Problem / Need",
    "u"."agent_action" AS "Agent Action",
    "u"."outcome_deliverable" AS "Outcome / Deliverable",
    "u"."risk_control_notes" AS "Risk & Control Notes",
    "u"."status" AS "Status",
    "u"."bfsi_process_taxonomy_id" AS "Process ID",
    "pp"."full_path" AS "Process Path",
    "u"."reach" AS "Reach",
    "u"."impact" AS "Impact",
    "u"."confidence" AS "Confidence",
    "u"."ease" AS "Ease",
    "u"."rice_score" AS "RICE Score",
    "u"."tags" AS "Tags",
    "to_char"("u"."created_at", 'YYYY-MM-DD'::"text") AS "Created",
    "to_char"("u"."updated_at", 'YYYY-MM-DD'::"text") AS "Updated",
    COALESCE("cap"."cap_codes", '{}'::"text"[]) AS "Capability Codes",
    COALESCE("cap"."cap_names", '{}'::"text"[]) AS "Capability Names",
    COALESCE("cap"."relation_types", '{}'::"text"[]) AS "Relation Types",
    COALESCE("cap"."cap_count", (0)::bigint) AS "Capability Count"
   FROM (("public"."ag_use_case" "u"
     LEFT JOIN "process_path" "pp" ON (("pp"."id" = "u"."bfsi_process_taxonomy_id")))
     LEFT JOIN "cap" ON (("cap"."use_case_id" = "u"."id")))
  ORDER BY "u"."rice_score" DESC NULLS LAST, "u"."updated_at" DESC;


ALTER VIEW "public"."ag_use_case_pretty" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ag_use_case_score_audit_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ag_use_case_score_audit_audit_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ag_use_case_score_audit_audit_id_seq" OWNED BY "public"."ag_use_case_audit"."audit_id";



CREATE TABLE IF NOT EXISTS "public"."ag_use_case_stg" (
    "id" integer NOT NULL,
    "name" "text",
    "persona" "text",
    "process_stage" "text",
    "problem_need" "text",
    "agent_action" "text",
    "outcome_deliverable" "text",
    "success_metrics" "jsonb",
    "inputs" "text",
    "outputs_evidence" "text",
    "risk_control_notes" "text",
    "status" "text",
    "priority" integer,
    "business_value_score" integer,
    "effort_score" integer,
    "updated_at" timestamp with time zone,
    "domain_id" integer,
    "business_area_id" integer,
    "function_id" integer,
    "line_of_defence_id" integer,
    "vendor_id" integer,
    "created_by" "uuid",
    "description" "text",
    "process_stage_order" integer,
    "required_capabilities" "jsonb",
    "tags" "jsonb",
    "l2_process" "text",
    "l3_process" "text",
    "l4_activity" "text",
    "l2_id" integer,
    "l3_id" integer,
    "l4_id" integer,
    "l1_id" integer,
    "l1_level" integer,
    "industry_id" integer,
    "process_id" integer,
    "benefit_type" "text",
    "maturity" "text",
    "sources" "text",
    "process_node_id" integer,
    "reach" integer,
    "impact" integer,
    "confidence" integer,
    "ease" integer,
    CONSTRAINT "ag_use_case_stg_confidence_check" CHECK ((("confidence" >= 1) AND ("confidence" <= 5))),
    CONSTRAINT "ag_use_case_stg_ease_check" CHECK ((("ease" >= 1) AND ("ease" <= 5))),
    CONSTRAINT "ag_use_case_stg_impact_check" CHECK ((("impact" >= 1) AND ("impact" <= 5))),
    CONSTRAINT "ag_use_case_stg_reach_check" CHECK ((("reach" >= 1) AND ("reach" <= 5)))
);

ALTER TABLE ONLY "public"."ag_use_case_stg" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_use_case_stg" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_vendor" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "aliases" "text"[],
    "website" "text",
    "hq_country" "text",
    "regions_served" "text"[],
    "founded_year" integer,
    "ownership_type" "text",
    "headcount_range" "text",
    "funding_stage" "text",
    "parent_entity" "text",
    "deployment" "text"[],
    "certifications" "text"[],
    "data_coverage" "jsonb",
    "pricing_model" "text",
    "notes" "text",
    "name_lc" "text" GENERATED ALWAYS AS ("lower"("name")) STORED,
    "name_norm" "text" GENERATED ALWAYS AS ("lower"("btrim"("name"))) STORED,
    "category" "text" DEFAULT 'Other'::"text"
);


ALTER TABLE "public"."ag_vendor" OWNER TO "postgres";


COMMENT ON TABLE "public"."ag_vendor" IS 'vendors of both agentic AI solutions and other IT-solutions';



ALTER TABLE "public"."ag_vendor" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ag_vendor_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."ag_vendor_pretty" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "id",
    COALESCE("category", '—'::"text") AS "category",
    "name",
    "website",
    "hq_country",
    "regions_served",
    "founded_year",
    "ownership_type",
    "headcount_range",
    "funding_stage",
    "to_char"("created_at", 'YYYY-MM-DD'::"text") AS "created_on",
    "to_char"("updated_at", 'YYYY-MM-DD'::"text") AS "updated_on"
   FROM "public"."ag_vendor" "v"
  ORDER BY COALESCE("category", 'ZZZ'::"text"), "name";


ALTER VIEW "public"."ag_vendor_pretty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_vendor_stg" (
    "batch_id" "uuid" DEFAULT "gen_random_uuid"(),
    "row_no" integer,
    "name" "text",
    "website" "text",
    "hq_country" "text",
    "regions_served" "text"[],
    "founded_year" "text",
    "ownership_type" "text",
    "headcount_range" "text",
    "funding_stage" "text",
    "parent_entity" "text",
    "deployment" "text"[],
    "certifications" "text"[],
    "data_coverage" "jsonb",
    "pricing_model" "text",
    "notes" "text",
    "aliases" "text"[],
    "op" "text" DEFAULT 'UPSERT'::"text",
    "loaded_at" timestamp with time zone DEFAULT "now"(),
    "id" bigint NOT NULL,
    CONSTRAINT "stg_range_chk" CHECK ((("headcount_range" IS NULL) OR ("headcount_range" = ANY (ARRAY['1-10'::"text", '11-50'::"text", '51-200'::"text", '201-500'::"text", '501-1000'::"text", '1001-5000'::"text", '5001-10000'::"text", '10001+'::"text"])))),
    CONSTRAINT "stg_year_chk" CHECK ((("founded_year" ~ '^\d{4}$'::"text") OR ("founded_year" IS NULL)))
);

ALTER TABLE ONLY "public"."ag_vendor_stg" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_vendor_stg" OWNER TO "postgres";


ALTER TABLE "public"."ag_vendor_stg" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ag_vendor_stg_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bfsi_industry_reference" (
    "id" integer NOT NULL,
    "taxonomy_id" integer NOT NULL,
    "scheme" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."bfsi_industry_reference" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bfsi_industry_reference_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bfsi_industry_reference_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bfsi_industry_reference_id_seq" OWNED BY "public"."bfsi_industry_reference"."id";



CREATE TABLE IF NOT EXISTS "public"."bfsi_industry_reference_stg" (
    "taxonomy_id" integer NOT NULL,
    "scheme" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "id" bigint NOT NULL
);

ALTER TABLE ONLY "public"."bfsi_industry_reference_stg" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_industry_reference_stg" OWNER TO "postgres";


ALTER TABLE "public"."bfsi_industry_reference_stg" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_industry_reference_stg_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."bfsi_industry_taxonomy_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bfsi_industry_taxonomy_id_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bfsi_industry_taxonomy" (
    "id" integer DEFAULT "nextval"('"public"."bfsi_industry_taxonomy_id_seq"'::"regclass") NOT NULL,
    "name" "text" NOT NULL,
    "level" integer NOT NULL,
    "parent_id" integer,
    "external_reference" "text",
    "slug" "text"
);


ALTER TABLE "public"."bfsi_industry_taxonomy" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."bfsi_industry_taxonomy_pretty" WITH ("security_invoker"='true', "security_barrier"='true') AS
 WITH "code_sets" AS (
         SELECT "bfsi_industry_reference"."taxonomy_id",
            "bfsi_industry_reference"."scheme",
            "string_agg"("bfsi_industry_reference"."code", ','::"text" ORDER BY "bfsi_industry_reference"."code") AS "codes_csv"
           FROM "public"."bfsi_industry_reference"
          GROUP BY "bfsi_industry_reference"."taxonomy_id", "bfsi_industry_reference"."scheme"
        ), "refs" AS (
         SELECT "code_sets"."taxonomy_id",
            "jsonb_object_agg"("code_sets"."scheme", "code_sets"."codes_csv") AS "ref_json"
           FROM "code_sets"
          GROUP BY "code_sets"."taxonomy_id"
        )
 SELECT "l1"."id" AS "l1_id",
    "l1"."name" AS "l1_domain",
    "l2"."id" AS "l2_id",
    "l2"."name" AS "l2_sector",
    "l3"."id" AS "l3_id",
    "l3"."name" AS "l3_subsector",
    ("r1"."ref_json")::"text" AS "l1_refs",
    ("r2"."ref_json")::"text" AS "l2_refs",
    ("r3"."ref_json")::"text" AS "l3_refs",
    "concat_ws"(' / '::"text", "l1"."name", "l2"."name", "l3"."name") AS "path"
   FROM ((((("public"."bfsi_industry_taxonomy" "l1"
     LEFT JOIN "public"."bfsi_industry_taxonomy" "l2" ON ((("l2"."parent_id" = "l1"."id") AND ("l2"."level" = 2))))
     LEFT JOIN "public"."bfsi_industry_taxonomy" "l3" ON ((("l3"."parent_id" = "l2"."id") AND ("l3"."level" = 3))))
     LEFT JOIN "refs" "r1" ON (("r1"."taxonomy_id" = "l1"."id")))
     LEFT JOIN "refs" "r2" ON (("r2"."taxonomy_id" = "l2"."id")))
     LEFT JOIN "refs" "r3" ON (("r3"."taxonomy_id" = "l3"."id")))
  WHERE ("l1"."level" = 1)
  ORDER BY "l1"."name", "l2"."name", "l3"."name";


ALTER VIEW "public"."bfsi_industry_taxonomy_pretty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bfsi_industry_taxonomy_stg" (
    "l1_name" "text" NOT NULL,
    "l2_name" "text",
    "l3_name" "text",
    "id" bigint NOT NULL
);

ALTER TABLE ONLY "public"."bfsi_industry_taxonomy_stg" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_industry_taxonomy_stg" OWNER TO "postgres";


ALTER TABLE "public"."bfsi_industry_taxonomy_stg" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_industry_taxonomy_stg_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bfsi_organization" (
    "id" integer NOT NULL,
    "organization_name" "text" NOT NULL,
    "description" "text",
    "entity_type" "text",
    "headquarters_country" "text",
    "involvement_in_payments" boolean
);


ALTER TABLE "public"."bfsi_organization" OWNER TO "postgres";


ALTER TABLE "public"."bfsi_organization" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_organization_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."bfsi_organization_pretty" WITH ("security_invoker"='on') AS
 SELECT "id",
    "organization_name" AS "name",
    "entity_type" AS "type",
    "headquarters_country" AS "country",
        CASE
            WHEN "involvement_in_payments" THEN 'Yes'::"text"
            ELSE 'No'::"text"
        END AS "payments",
    "description"
   FROM "public"."bfsi_organization" "o"
  ORDER BY "organization_name";


ALTER VIEW "public"."bfsi_organization_pretty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bfsi_organization_stg" (
    "organization_id" integer,
    "organization_name" "text",
    "description" "text",
    "entity_type" "text",
    "headquarters_country" "text",
    "involvement_in_payments" boolean,
    "id" bigint NOT NULL
);


ALTER TABLE "public"."bfsi_organization_stg" OWNER TO "postgres";


ALTER TABLE "public"."bfsi_organization_stg" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_organization_stg_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bfsi_process_ref_rules" (
    "pattern" "text" NOT NULL,
    "scheme" "text" NOT NULL,
    "code" "text" NOT NULL,
    "note" "text",
    "id" bigint NOT NULL
);


ALTER TABLE "public"."bfsi_process_ref_rules" OWNER TO "postgres";


ALTER TABLE "public"."bfsi_process_ref_rules" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_process_ref_rules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bfsi_process_reference" (
    "id" integer NOT NULL,
    "taxonomy_id" "text" NOT NULL,
    "scheme" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."bfsi_process_reference" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bfsi_process_reference_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bfsi_process_reference_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bfsi_process_reference_id_seq" OWNED BY "public"."bfsi_process_reference"."id";



CREATE TABLE IF NOT EXISTS "public"."bfsi_process_reference_stg" (
    "taxonomy_id" "text" NOT NULL,
    "scheme" "text",
    "code" "text",
    "description" "text",
    "id" bigint NOT NULL
);

ALTER TABLE ONLY "public"."bfsi_process_reference_stg" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_process_reference_stg" OWNER TO "postgres";


ALTER TABLE "public"."bfsi_process_reference_stg" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_process_reference_stg_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."bfsi_process_taxonomy_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bfsi_process_taxonomy_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bfsi_process_taxonomy_id_seq" OWNED BY "public"."bfsi_process_taxonomy"."id";



CREATE OR REPLACE VIEW "public"."bfsi_process_taxonomy_pretty" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "l0"."id" AS "l0_id",
    "l0"."name" AS "l0_domain",
    "l1"."id" AS "l1_id",
    "l1"."name" AS "l1_process_group",
    "l2"."id" AS "l2_id",
    "l2"."name" AS "l2_process",
    "l3"."id" AS "l3_id",
    "l3"."name" AS "l3_process_step",
    ((("l0"."name" || COALESCE((' / '::"text" || "l1"."name"), ''::"text")) || COALESCE((' / '::"text" || "l2"."name"), ''::"text")) || COALESCE((' / '::"text" || "l3"."name"), ''::"text")) AS "path"
   FROM ((("public"."bfsi_process_taxonomy" "l0"
     LEFT JOIN "public"."bfsi_process_taxonomy" "l1" ON ((("l1"."parent_id" = "l0"."id") AND ("l1"."level" = 1))))
     LEFT JOIN "public"."bfsi_process_taxonomy" "l2" ON ((("l2"."parent_id" = "l1"."id") AND ("l2"."level" = 2))))
     LEFT JOIN "public"."bfsi_process_taxonomy" "l3" ON ((("l3"."parent_id" = "l2"."id") AND ("l3"."level" = 3))))
  WHERE ("l0"."level" = 0);


ALTER VIEW "public"."bfsi_process_taxonomy_pretty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bfsi_process_taxonomy_stg" (
    "l0_domain" "text" NOT NULL,
    "l1_group" "text" NOT NULL,
    "l2_process" "text" NOT NULL,
    "l3_step" "text",
    "id" bigint NOT NULL
);

ALTER TABLE ONLY "public"."bfsi_process_taxonomy_stg" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_process_taxonomy_stg" OWNER TO "postgres";


ALTER TABLE "public"."bfsi_process_taxonomy_stg" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_process_taxonomy_stg_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."regulation" (
    "id" integer NOT NULL,
    "code" "text",
    "title" "text" NOT NULL,
    "instrument_type" "text",
    "jurisdiction" "text",
    "scope_goals" "text",
    "status" "text",
    "effective_from" "date",
    "effective_to" "date",
    "obligations" "jsonb",
    "deadlines" "jsonb",
    "sources" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "regulator_id" bigint,
    "domain" "text"
);


ALTER TABLE "public"."regulation" OWNER TO "postgres";


ALTER TABLE "public"."regulation" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_regulation_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."regulation_stg" (
    "domain" "text",
    "code" "text",
    "title" "text",
    "instrument_type" "text",
    "jurisdiction" "text",
    "scope_goals" "text",
    "key_obligations" "text",
    "deadlines" "text",
    "status_impact" "text",
    "authorities" "text",
    "sources" "text",
    "notes" "text",
    "id" bigint NOT NULL
);


ALTER TABLE "public"."regulation_stg" OWNER TO "postgres";


ALTER TABLE "public"."regulation_stg" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bfsi_regulation_stg_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."industry_taxonomy_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."industry_taxonomy_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."industry_taxonomy_id_seq" OWNED BY "public"."bfsi_industry_taxonomy"."id";



CREATE TABLE IF NOT EXISTS "public"."regulator" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "website_url" "text",
    "jurisdiction" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "domain" "text",
    CONSTRAINT "regulator_slug_check" CHECK (("slug" ~ '^[a-z0-9-]+$'::"text"))
);


ALTER TABLE "public"."regulator" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."regulation_obligations_pretty" AS
 SELECT "r"."id",
    "r"."code",
    "r"."title",
    ("jsonb_array_elements"("r"."obligations") ->> 'text'::"text") AS "obligation",
    "r"."domain",
    "rg"."name" AS "regulator_name"
   FROM ("public"."regulation" "r"
     LEFT JOIN "public"."regulator" "rg" ON (("rg"."id" = "r"."regulator_id")));


ALTER VIEW "public"."regulation_obligations_pretty" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."regulation_pretty" AS
 SELECT "r"."id",
    "r"."code",
    "r"."title",
    "r"."instrument_type",
    "r"."jurisdiction",
    "rg"."name" AS "regulator_name",
    "r"."scope_goals",
    "r"."status",
    "r"."effective_from",
    "r"."effective_to",
    "r"."obligations",
    "r"."deadlines",
    "r"."sources",
    "r"."notes",
    "r"."created_at",
    "r"."updated_at",
    "r"."regulator_id",
    "rg"."slug" AS "regulator_slug",
    "rg"."website_url" AS "regulator_website_url",
    "rg"."jurisdiction" AS "regulator_jurisdiction",
    "r"."domain"
   FROM ("public"."regulation" "r"
     LEFT JOIN "public"."regulator" "rg" ON (("rg"."id" = "r"."regulator_id")));


ALTER VIEW "public"."regulation_pretty" OWNER TO "postgres";


ALTER TABLE "public"."regulator" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."regulator_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."regulator_pretty" AS
 SELECT "id",
    "name",
    "slug",
    "jurisdiction",
    "website_url"
   FROM "public"."regulator";


ALTER VIEW "public"."regulator_pretty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regulator_stg" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "website_url" "text",
    "jurisdiction" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "src_system" "text",
    "src_file" "text",
    "src_row" "jsonb",
    "loaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "op" "text",
    "domain" "text",
    CONSTRAINT "regulator_stg_op_check" CHECK (("op" = ANY (ARRAY['I'::"text", 'U'::"text", 'D'::"text"])))
);


ALTER TABLE "public"."regulator_stg" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."rls_status" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "c"."relname" AS "table_name",
    "c"."relrowsecurity" AS "rls_enabled"
   FROM ("pg_class" "c"
     JOIN "pg_namespace" "n" ON (("n"."oid" = "c"."relnamespace")))
  WHERE (("n"."nspname" = 'public'::"name") AND ("c"."relkind" = 'r'::"char"))
  ORDER BY "c"."relname";


ALTER VIEW "public"."rls_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rtm_source" (
    "id" integer NOT NULL,
    "source_id" integer,
    "title" "text" NOT NULL,
    "author" "text",
    "publication_date" "date",
    "url" "text",
    "domain_category" "text",
    "subject_area" "text",
    "source_type" "text",
    "description" "text",
    "tags" "text"[],
    "notes" "text"
);


ALTER TABLE "public"."rtm_source" OWNER TO "postgres";


ALTER TABLE "public"."rtm_source" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rtm_source_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."rtm_source_stg" (
    "source_id" integer,
    "title" "text",
    "author" "text",
    "publication_date" "text",
    "url" "text",
    "domain_category" "text",
    "subject_area" "text",
    "source_type" "text",
    "description" "text",
    "tags" "text",
    "notes" "text",
    "id" bigint NOT NULL
);


ALTER TABLE "public"."rtm_source_stg" OWNER TO "postgres";


ALTER TABLE "public"."rtm_source_stg" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rtm_source_stg_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."standard" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "version" "text",
    "status" "text" DEFAULT 'active'::"text",
    "published_on" "date",
    "last_revised_on" "date",
    "summary" "text",
    "source_url" "text",
    "standard_setter_id" bigint,
    "regulator_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "domain" "text",
    CONSTRAINT "standard_slug_check" CHECK (("slug" ~ '^[a-z0-9-]+$'::"text")),
    CONSTRAINT "standard_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'retired'::"text"])))
);


ALTER TABLE "public"."standard" OWNER TO "postgres";


ALTER TABLE "public"."standard" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."standard_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."standard_setter" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "website_url" "text",
    "country_code" character(2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "domain" "text",
    CONSTRAINT "standard_setter_slug_check" CHECK (("slug" ~ '^[a-z0-9-]+$'::"text"))
);


ALTER TABLE "public"."standard_setter" OWNER TO "postgres";


ALTER TABLE "public"."standard_setter" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."standard_setter_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."standard_setter_stg" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "website_url" "text",
    "country_code" character(2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "src_system" "text",
    "src_file" "text",
    "src_row" "jsonb",
    "loaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "op" "text",
    "domain" "text",
    CONSTRAINT "standard_setter_stg_op_check" CHECK (("op" = ANY (ARRAY['I'::"text", 'U'::"text", 'D'::"text"])))
);


ALTER TABLE "public"."standard_setter_stg" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."standard_stg" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "version" "text",
    "status" "text" DEFAULT 'active'::"text",
    "published_on" "date",
    "last_revised_on" "date",
    "summary" "text",
    "source_url" "text",
    "standard_setter_id" bigint,
    "regulator_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "src_system" "text",
    "src_file" "text",
    "src_row" "jsonb",
    "loaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "op" "text",
    "domain" "text",
    CONSTRAINT "standard_stg_op_check" CHECK (("op" = ANY (ARRAY['I'::"text", 'U'::"text", 'D'::"text"])))
);


ALTER TABLE "public"."standard_stg" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tables_columns" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "c"."table_name",
    "string_agg"(((("c"."column_name")::"text" || ' '::"text") || ("c"."data_type")::"text"), ', '::"text" ORDER BY "c"."ordinal_position") AS "columns"
   FROM ("information_schema"."columns" "c"
     JOIN "information_schema"."tables" "t" ON (((("t"."table_schema")::"name" = ("c"."table_schema")::"name") AND (("t"."table_name")::"name" = ("c"."table_name")::"name"))))
  WHERE ((("c"."table_schema")::"name" = 'public'::"name") AND (("t"."table_type")::"text" = 'BASE TABLE'::"text"))
  GROUP BY "c"."table_name"
  ORDER BY "c"."table_name";


ALTER VIEW "public"."tables_columns" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."views" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "table_name",
    "view_definition"
   FROM "information_schema"."views"
  WHERE (("table_schema")::"name" = 'public'::"name")
  ORDER BY "table_name";


ALTER VIEW "public"."views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "stg"."ag_capability_stg" (
    "code" "text",
    "name" "text",
    "description" "text",
    "category" "text",
    "tags" "text"[],
    "ag_use_case_ids" bigint[],
    "stage_id" bigint NOT NULL
);

ALTER TABLE ONLY "stg"."ag_capability_stg" FORCE ROW LEVEL SECURITY;


ALTER TABLE "stg"."ag_capability_stg" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "stg"."ag_capability_stg_stage_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "stg"."ag_capability_stg_stage_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "stg"."ag_capability_stg_stage_id_seq" OWNED BY "stg"."ag_capability_stg"."stage_id";



CREATE TABLE IF NOT EXISTS "stg"."ag_use_case_capability" (
    "use_case_code" "text",
    "use_case_id" bigint,
    "capability_code" "text",
    "capability_id" bigint,
    "relation_type" "text" DEFAULT 'required'::"text",
    "weight" numeric(5,2),
    "rationale" "text",
    "source_system" "text",
    "batch_id" "text",
    "loaded_at" timestamp with time zone DEFAULT "now"(),
    "stage_id" bigint NOT NULL,
    "use_case_key" "text" GENERATED ALWAYS AS (COALESCE("use_case_code", ("use_case_id")::"text")) STORED,
    "capability_key" "text" GENERATED ALWAYS AS (COALESCE("capability_code", ("capability_id")::"text")) STORED
);


ALTER TABLE "stg"."ag_use_case_capability" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "stg"."ag_use_case_capability_stage_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "stg"."ag_use_case_capability_stage_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "stg"."ag_use_case_capability_stage_id_seq" OWNED BY "stg"."ag_use_case_capability"."stage_id";



ALTER TABLE ONLY "public"."ag_use_case_audit" ALTER COLUMN "audit_id" SET DEFAULT "nextval"('"public"."ag_use_case_score_audit_audit_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bfsi_industry_reference" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bfsi_industry_reference_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bfsi_process_reference" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bfsi_process_reference_id_seq"'::"regclass");



ALTER TABLE ONLY "stg"."ag_capability_stg" ALTER COLUMN "stage_id" SET DEFAULT "nextval"('"stg"."ag_capability_stg_stage_id_seq"'::"regclass");



ALTER TABLE ONLY "stg"."ag_use_case_capability" ALTER COLUMN "stage_id" SET DEFAULT "nextval"('"stg"."ag_use_case_capability_stage_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ag_use_case"
    ADD CONSTRAINT "AG - Use-Case_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_capability"
    ADD CONSTRAINT "ag_capability_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ag_capability"
    ADD CONSTRAINT "ag_capability_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."ag_capability"
    ADD CONSTRAINT "ag_capability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_use_case_capability"
    ADD CONSTRAINT "ag_use_case_capability_pkey" PRIMARY KEY ("use_case_id", "capability_id");



ALTER TABLE ONLY "public"."ag_use_case"
    ADD CONSTRAINT "ag_use_case_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ag_use_case"
    ADD CONSTRAINT "ag_use_case_name_unique_ci" UNIQUE ("name_ci");



ALTER TABLE ONLY "public"."ag_use_case_audit"
    ADD CONSTRAINT "ag_use_case_score_audit_pkey" PRIMARY KEY ("audit_id");



ALTER TABLE ONLY "public"."ag_use_case_stg"
    ADD CONSTRAINT "ag_use_case_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_vendor"
    ADD CONSTRAINT "ag_vendor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_vendor_stg"
    ADD CONSTRAINT "ag_vendor_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_industry_reference"
    ADD CONSTRAINT "bfsi_industry_reference_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_industry_reference_stg"
    ADD CONSTRAINT "bfsi_industry_reference_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_industry_reference"
    ADD CONSTRAINT "bfsi_industry_reference_taxonomy_id_scheme_code_key" UNIQUE ("taxonomy_id", "scheme", "code");



ALTER TABLE ONLY "public"."bfsi_industry_taxonomy"
    ADD CONSTRAINT "bfsi_industry_taxonomy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_industry_taxonomy"
    ADD CONSTRAINT "bfsi_industry_taxonomy_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."bfsi_industry_taxonomy_stg"
    ADD CONSTRAINT "bfsi_industry_taxonomy_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_organization"
    ADD CONSTRAINT "bfsi_organization_organization_name_key" UNIQUE ("organization_name");



ALTER TABLE ONLY "public"."bfsi_organization"
    ADD CONSTRAINT "bfsi_organization_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_organization_stg"
    ADD CONSTRAINT "bfsi_organization_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_process_ref_rules"
    ADD CONSTRAINT "bfsi_process_ref_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_process_reference"
    ADD CONSTRAINT "bfsi_process_reference_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_process_reference_stg"
    ADD CONSTRAINT "bfsi_process_reference_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_process_reference"
    ADD CONSTRAINT "bfsi_process_reference_taxonomy_id_scheme_code_key" UNIQUE ("taxonomy_id", "scheme", "code");



ALTER TABLE ONLY "public"."bfsi_process_taxonomy"
    ADD CONSTRAINT "bfsi_process_taxonomy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bfsi_process_taxonomy_stg"
    ADD CONSTRAINT "bfsi_process_taxonomy_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regulation"
    ADD CONSTRAINT "bfsi_regulation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regulation_stg"
    ADD CONSTRAINT "bfsi_regulation_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regulator"
    ADD CONSTRAINT "regulator_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regulator"
    ADD CONSTRAINT "regulator_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."regulator_stg"
    ADD CONSTRAINT "regulator_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rtm_source"
    ADD CONSTRAINT "rtm_source_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rtm_source_stg"
    ADD CONSTRAINT "rtm_source_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."standard"
    ADD CONSTRAINT "standard_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."standard_setter"
    ADD CONSTRAINT "standard_setter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."standard_setter"
    ADD CONSTRAINT "standard_setter_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."standard_setter_stg"
    ADD CONSTRAINT "standard_setter_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."standard"
    ADD CONSTRAINT "standard_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."standard_stg"
    ADD CONSTRAINT "standard_stg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "stg"."ag_capability_stg"
    ADD CONSTRAINT "ag_capability_stg_pkey" PRIMARY KEY ("stage_id");



ALTER TABLE ONLY "stg"."ag_use_case_capability"
    ADD CONSTRAINT "ag_use_case_capability_pkey" PRIMARY KEY ("stage_id");



ALTER TABLE ONLY "stg"."ag_use_case_capability"
    ADD CONSTRAINT "agucc_stg_key_uniq" UNIQUE ("use_case_key", "capability_key");



CREATE INDEX "ag_use_case_bit_fk_idx" ON "public"."ag_use_case" USING "btree" ("bfsi_industry_taxonomy_id");



CREATE INDEX "ag_use_case_bpt_fk_idx" ON "public"."ag_use_case" USING "btree" ("bfsi_process_taxonomy_id");



CREATE INDEX "agucc_capability_fk_idx" ON "public"."ag_use_case_capability" USING "btree" ("capability_id");



CREATE INDEX "idx_regulation_regulator_id" ON "public"."regulation" USING "btree" ("regulator_id");



CREATE INDEX "ix_ag_use_case_bfsi_industry_taxonomy" ON "public"."ag_use_case" USING "btree" ("bfsi_industry_taxonomy_id");



CREATE INDEX "ix_bfsi_industry_taxonomy_parent" ON "public"."bfsi_industry_taxonomy" USING "btree" ("parent_id");



CREATE INDEX "ix_bfsi_process_taxonomy_parent" ON "public"."bfsi_process_taxonomy" USING "btree" ("parent_id");



CREATE INDEX "standard_regulator_fk_idx" ON "public"."standard" USING "btree" ("regulator_id");



CREATE INDEX "standard_standard_setter_fk_idx" ON "public"."standard" USING "btree" ("standard_setter_id");



CREATE UNIQUE INDEX "uq_ag_vendor_name_norm" ON "public"."ag_vendor" USING "btree" ("lower"(TRIM(BOTH FROM "name")));



CREATE UNIQUE INDEX "ux_bfpr_stg" ON "public"."bfsi_process_reference_stg" USING "btree" ("taxonomy_id", "scheme", "code");



CREATE UNIQUE INDEX "ux_bfsi_industry_taxonomy" ON "public"."bfsi_industry_taxonomy" USING "btree" ("level", "name", COALESCE("parent_id", 0));



CREATE UNIQUE INDEX "ux_ref_stg" ON "public"."bfsi_industry_reference_stg" USING "btree" ("taxonomy_id", "scheme", "code");



CREATE UNIQUE INDEX "ux_rtm_source_source_id" ON "public"."rtm_source" USING "btree" ("source_id") WHERE ("source_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "trg_ag_vendor_updated" BEFORE UPDATE ON "public"."ag_vendor" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_agucc_updated" BEFORE UPDATE ON "public"."ag_use_case_capability" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_ag_use_case_rice" AFTER UPDATE OF "reach", "impact", "confidence", "ease" ON "public"."ag_use_case" FOR EACH ROW WHEN ((("old"."reach" IS DISTINCT FROM "new"."reach") OR ("old"."impact" IS DISTINCT FROM "new"."impact") OR ("old"."confidence" IS DISTINCT FROM "new"."confidence") OR ("old"."ease" IS DISTINCT FROM "new"."ease"))) EXECUTE FUNCTION "public"."fn_log_ag_use_case_change"();



CREATE OR REPLACE TRIGGER "trg_regulator_updated_at" BEFORE UPDATE ON "public"."regulator" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_standard_setter_updated_at" BEFORE UPDATE ON "public"."standard_setter" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_standard_updated_at" BEFORE UPDATE ON "public"."standard" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ucc_updated" BEFORE UPDATE ON "public"."ag_use_case_capability" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vendor_updated_at" BEFORE UPDATE ON "public"."ag_vendor" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_vendor"();



ALTER TABLE ONLY "public"."ag_use_case_capability"
    ADD CONSTRAINT "ag_use_case_capability_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "public"."ag_capability"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ag_use_case_capability"
    ADD CONSTRAINT "ag_use_case_capability_use_case_id_fkey" FOREIGN KEY ("use_case_id") REFERENCES "public"."ag_use_case"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ag_use_case"
    ADD CONSTRAINT "ag_use_case_industry_fk" FOREIGN KEY ("bfsi_industry_taxonomy_id") REFERENCES "public"."bfsi_industry_taxonomy"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ag_use_case"
    ADD CONSTRAINT "ag_use_case_process_fk" FOREIGN KEY ("bfsi_process_taxonomy_id") REFERENCES "public"."bfsi_process_taxonomy"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bfsi_industry_reference"
    ADD CONSTRAINT "bfsi_industry_reference_taxonomy_id_fkey" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."bfsi_industry_taxonomy"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bfsi_process_reference"
    ADD CONSTRAINT "bfsi_process_reference_taxonomy_id_fkey" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."bfsi_process_taxonomy"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bfsi_process_taxonomy"
    ADD CONSTRAINT "bfsi_process_taxonomy_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."bfsi_process_taxonomy"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bfsi_industry_taxonomy"
    ADD CONSTRAINT "industry_taxonomy_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."bfsi_industry_taxonomy"("id");



ALTER TABLE ONLY "public"."regulation"
    ADD CONSTRAINT "regulation_regulator_fk" FOREIGN KEY ("regulator_id") REFERENCES "public"."regulator"("id");



ALTER TABLE ONLY "public"."standard"
    ADD CONSTRAINT "standard_regulator_id_fkey" FOREIGN KEY ("regulator_id") REFERENCES "public"."regulator"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."standard"
    ADD CONSTRAINT "standard_standard_setter_id_fkey" FOREIGN KEY ("standard_setter_id") REFERENCES "public"."standard_setter"("id") ON DELETE SET NULL;



CREATE POLICY "ag_cap_all_service" ON "public"."ag_capability" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "ag_cap_select_auth" ON "public"."ag_capability" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."ag_capability" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ag_ucc_all_service" ON "public"."ag_use_case_capability" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "ag_ucc_select_auth" ON "public"."ag_use_case_capability" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."ag_use_case" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_use_case_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_use_case_capability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_use_case_stg" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_vendor" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_vendor_stg" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "all_ag_use_case_audit_service" ON "public"."ag_use_case_audit" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_ag_use_case_stg_service" ON "public"."ag_use_case_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_ag_vendor_stg_service" ON "public"."ag_vendor_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_industry_reference_service" ON "public"."bfsi_industry_reference" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_industry_reference_stg_service" ON "public"."bfsi_industry_reference_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_industry_taxonomy_stg_service" ON "public"."bfsi_industry_taxonomy_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_organization_service" ON "public"."bfsi_organization" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_organization_stg_service" ON "public"."bfsi_organization_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_process_ref_rules_service" ON "public"."bfsi_process_ref_rules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_process_reference_service" ON "public"."bfsi_process_reference" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_process_reference_stg_service" ON "public"."bfsi_process_reference_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_process_taxonomy_stg_service" ON "public"."bfsi_process_taxonomy_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_regulation_service" ON "public"."regulation" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_bfsi_regulation_stg_service" ON "public"."regulation_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_rtm_source_service" ON "public"."rtm_source" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "all_rtm_source_stg_service" ON "public"."rtm_source_stg" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."bfsi_industry_reference" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_industry_reference_stg" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_industry_taxonomy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_industry_taxonomy_stg" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_organization" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_organization_stg" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_process_ref_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_process_reference" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_process_reference_stg" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_process_taxonomy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bfsi_process_taxonomy_stg" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "del_own_vendor" ON "public"."ag_vendor" FOR DELETE TO "authenticated" USING (("created_by" = "app"."current_uid"()));



CREATE POLICY "ins_own_vendor" ON "public"."ag_vendor" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "app"."current_uid"()));



CREATE POLICY "read_all_uc_authenticated" ON "public"."ag_use_case" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read_all_uc_authenticator" ON "public"."ag_use_case" FOR SELECT TO "authenticator" USING (true);



CREATE POLICY "read_all_uc_dashboard_user" ON "public"."ag_use_case" FOR SELECT TO "dashboard_user" USING (true);



CREATE POLICY "read_all_vendor" ON "public"."ag_vendor" FOR SELECT USING (true);



ALTER TABLE "public"."regulation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regulation_stg" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regulator" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "regulator_select_auth" ON "public"."regulator" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."regulator_stg" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "regulator_stg_service_all" ON "public"."regulator_stg" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."rtm_source" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rtm_source_stg" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_bfsi_industry_reference_authenticated" ON "public"."bfsi_industry_reference" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "select_bfsi_industry_taxonomy" ON "public"."bfsi_industry_taxonomy" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "select_bfsi_organization_authenticated" ON "public"."bfsi_organization" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "select_bfsi_process_ref_rules_authenticated" ON "public"."bfsi_process_ref_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "select_bfsi_process_reference_authenticated" ON "public"."bfsi_process_reference" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "select_bfsi_process_taxonomy" ON "public"."bfsi_process_taxonomy" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "select_bfsi_regulation_authenticated" ON "public"."regulation" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "select_rtm_source_authenticated" ON "public"."rtm_source" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."standard" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "standard_select_auth" ON "public"."standard" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."standard_setter" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "standard_setter_select_auth" ON "public"."standard_setter" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."standard_setter_stg" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "standard_setter_stg_service_all" ON "public"."standard_setter_stg" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."standard_stg" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "standard_stg_service_all" ON "public"."standard_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "upd_own_vendor" ON "public"."ag_vendor" FOR UPDATE TO "authenticated" USING (("created_by" = "app"."current_uid"())) WITH CHECK (("created_by" = "app"."current_uid"()));



CREATE POLICY "ag_cap_stg_all_service" ON "stg"."ag_capability_stg" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "ag_cap_stg_select_none" ON "stg"."ag_capability_stg" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "stg"."ag_capability_stg" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































































































































GRANT ALL ON FUNCTION "public"."ag_taxo_get_or_create"("_level" integer, "_parent_id" bigint, "_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ag_taxo_get_or_create"("_level" integer, "_parent_id" bigint, "_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ag_taxo_get_or_create"("_level" integer, "_parent_id" bigint, "_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ag_taxonomy_merge_from_staging"("p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ag_taxonomy_merge_from_staging"("p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ag_taxonomy_merge_from_staging"("p_batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ag_use_case_taxo_autofill"() TO "anon";
GRANT ALL ON FUNCTION "public"."ag_use_case_taxo_autofill"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ag_use_case_taxo_autofill"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ag_vendor_merge_all_from_staging"("clear_after" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."ag_vendor_merge_all_from_staging"("clear_after" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ag_vendor_merge_all_from_staging"("clear_after" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."ag_vendor_merge_from_staging"("_batch" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ag_vendor_merge_from_staging"("_batch" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ag_vendor_merge_from_staging"("_batch" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ag_vendor_merge_from_staging_return"("_batch" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ag_vendor_merge_from_staging_return"("_batch" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ag_vendor_merge_from_staging_return"("_batch" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ag_vendor_upsert_from_stg"() TO "anon";
GRANT ALL ON FUNCTION "public"."ag_vendor_upsert_from_stg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ag_vendor_upsert_from_stg"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_log_ag_use_case_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_log_ag_use_case_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_log_ag_use_case_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_log_ag_use_case_rice_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_log_ag_use_case_rice_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_log_ag_use_case_rice_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_text_to_jsonb"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."list_text_to_jsonb"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_text_to_jsonb"("t" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_text_to_textarray"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."list_text_to_textarray"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_text_to_textarray"("t" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_text"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text"("t" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_vendor"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_vendor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_vendor"() TO "service_role";


















GRANT ALL ON TABLE "public"."ag_use_case" TO "anon";
GRANT ALL ON TABLE "public"."ag_use_case" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_use_case" TO "service_role";



GRANT ALL ON SEQUENCE "public"."AG - Use-Case_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."AG - Use-Case_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."AG - Use-Case_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ag_capability" TO "anon";
GRANT ALL ON TABLE "public"."ag_capability" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_capability" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ag_capability_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ag_capability_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ag_capability_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ag_use_case_capability" TO "anon";
GRANT ALL ON TABLE "public"."ag_use_case_capability" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_use_case_capability" TO "service_role";



GRANT ALL ON TABLE "public"."ag_capability_pretty" TO "anon";
GRANT ALL ON TABLE "public"."ag_capability_pretty" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_capability_pretty" TO "service_role";



GRANT ALL ON TABLE "public"."ag_use_case_audit" TO "service_role";



GRANT ALL ON TABLE "public"."ag_use_case_capability_pretty" TO "anon";
GRANT ALL ON TABLE "public"."ag_use_case_capability_pretty" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_use_case_capability_pretty" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_process_taxonomy" TO "service_role";
GRANT SELECT ON TABLE "public"."bfsi_process_taxonomy" TO "anon";
GRANT SELECT ON TABLE "public"."bfsi_process_taxonomy" TO "authenticated";



GRANT ALL ON TABLE "public"."ag_use_case_pretty" TO "anon";
GRANT ALL ON TABLE "public"."ag_use_case_pretty" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_use_case_pretty" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ag_use_case_score_audit_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ag_use_case_score_audit_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ag_use_case_score_audit_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ag_use_case_stg" TO "service_role";



GRANT ALL ON TABLE "public"."ag_vendor" TO "anon";
GRANT ALL ON TABLE "public"."ag_vendor" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_vendor" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ag_vendor_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ag_vendor_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ag_vendor_id_seq" TO "service_role";



GRANT SELECT ON TABLE "public"."ag_vendor_pretty" TO "anon";
GRANT SELECT ON TABLE "public"."ag_vendor_pretty" TO "authenticated";
GRANT SELECT ON TABLE "public"."ag_vendor_pretty" TO "service_role";



GRANT ALL ON TABLE "public"."ag_vendor_stg" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ag_vendor_stg_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ag_vendor_stg_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ag_vendor_stg_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_industry_reference" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_industry_reference_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_industry_reference_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_industry_reference_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_industry_reference_stg" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_industry_reference_stg_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_industry_reference_stg_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_industry_reference_stg_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_industry_taxonomy_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_industry_taxonomy_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_industry_taxonomy_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_industry_taxonomy" TO "service_role";
GRANT SELECT ON TABLE "public"."bfsi_industry_taxonomy" TO "anon";
GRANT SELECT ON TABLE "public"."bfsi_industry_taxonomy" TO "authenticated";



GRANT SELECT ON TABLE "public"."bfsi_industry_taxonomy_pretty" TO "anon";
GRANT SELECT ON TABLE "public"."bfsi_industry_taxonomy_pretty" TO "authenticated";
GRANT SELECT ON TABLE "public"."bfsi_industry_taxonomy_pretty" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_industry_taxonomy_stg" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_industry_taxonomy_stg_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_industry_taxonomy_stg_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_industry_taxonomy_stg_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_organization" TO "anon";
GRANT ALL ON TABLE "public"."bfsi_organization" TO "authenticated";
GRANT ALL ON TABLE "public"."bfsi_organization" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_organization_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_organization_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_organization_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_organization_pretty" TO "anon";
GRANT ALL ON TABLE "public"."bfsi_organization_pretty" TO "authenticated";
GRANT ALL ON TABLE "public"."bfsi_organization_pretty" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_organization_stg" TO "anon";
GRANT ALL ON TABLE "public"."bfsi_organization_stg" TO "authenticated";
GRANT ALL ON TABLE "public"."bfsi_organization_stg" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_organization_stg_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_organization_stg_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_organization_stg_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_process_ref_rules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_process_ref_rules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_process_ref_rules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_process_ref_rules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_process_reference" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_process_reference_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_process_reference_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_process_reference_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_process_reference_stg" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_process_reference_stg_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_process_reference_stg_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_process_reference_stg_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_process_taxonomy_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_process_taxonomy_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_process_taxonomy_id_seq" TO "service_role";



GRANT SELECT ON TABLE "public"."bfsi_process_taxonomy_pretty" TO "anon";
GRANT SELECT ON TABLE "public"."bfsi_process_taxonomy_pretty" TO "authenticated";
GRANT SELECT ON TABLE "public"."bfsi_process_taxonomy_pretty" TO "service_role";



GRANT ALL ON TABLE "public"."bfsi_process_taxonomy_stg" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_process_taxonomy_stg_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_process_taxonomy_stg_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_process_taxonomy_stg_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."regulation" TO "anon";
GRANT ALL ON TABLE "public"."regulation" TO "authenticated";
GRANT ALL ON TABLE "public"."regulation" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_regulation_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_regulation_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_regulation_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."regulation_stg" TO "anon";
GRANT ALL ON TABLE "public"."regulation_stg" TO "authenticated";
GRANT ALL ON TABLE "public"."regulation_stg" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bfsi_regulation_stg_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bfsi_regulation_stg_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bfsi_regulation_stg_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."industry_taxonomy_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."industry_taxonomy_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."industry_taxonomy_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."regulator" TO "service_role";
GRANT SELECT ON TABLE "public"."regulator" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."regulator_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."regulator_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."regulator_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."regulator_stg" TO "service_role";



GRANT ALL ON TABLE "public"."rls_status" TO "service_role";



GRANT ALL ON TABLE "public"."rtm_source" TO "anon";
GRANT ALL ON TABLE "public"."rtm_source" TO "authenticated";
GRANT ALL ON TABLE "public"."rtm_source" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rtm_source_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rtm_source_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rtm_source_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rtm_source_stg" TO "anon";
GRANT ALL ON TABLE "public"."rtm_source_stg" TO "authenticated";
GRANT ALL ON TABLE "public"."rtm_source_stg" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rtm_source_stg_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rtm_source_stg_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rtm_source_stg_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."standard" TO "service_role";
GRANT SELECT ON TABLE "public"."standard" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."standard_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."standard_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."standard_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."standard_setter" TO "service_role";
GRANT SELECT ON TABLE "public"."standard_setter" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."standard_setter_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."standard_setter_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."standard_setter_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."standard_setter_stg" TO "service_role";



GRANT ALL ON TABLE "public"."standard_stg" TO "service_role";



GRANT ALL ON TABLE "public"."tables_columns" TO "service_role";



GRANT ALL ON TABLE "public"."views" TO "anon";
GRANT ALL ON TABLE "public"."views" TO "authenticated";
GRANT ALL ON TABLE "public"."views" TO "service_role";



GRANT ALL ON TABLE "stg"."ag_capability_stg" TO "anon";
GRANT ALL ON TABLE "stg"."ag_capability_stg" TO "authenticated";
GRANT ALL ON TABLE "stg"."ag_capability_stg" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "select_bfsi_industry_taxonomy" on "public"."bfsi_industry_taxonomy";

drop policy "select_bfsi_process_taxonomy" on "public"."bfsi_process_taxonomy";

revoke delete on table "public"."ag_use_case_audit" from "anon";

revoke insert on table "public"."ag_use_case_audit" from "anon";

revoke references on table "public"."ag_use_case_audit" from "anon";

revoke select on table "public"."ag_use_case_audit" from "anon";

revoke trigger on table "public"."ag_use_case_audit" from "anon";

revoke truncate on table "public"."ag_use_case_audit" from "anon";

revoke update on table "public"."ag_use_case_audit" from "anon";

revoke delete on table "public"."ag_use_case_audit" from "authenticated";

revoke insert on table "public"."ag_use_case_audit" from "authenticated";

revoke references on table "public"."ag_use_case_audit" from "authenticated";

revoke select on table "public"."ag_use_case_audit" from "authenticated";

revoke trigger on table "public"."ag_use_case_audit" from "authenticated";

revoke truncate on table "public"."ag_use_case_audit" from "authenticated";

revoke update on table "public"."ag_use_case_audit" from "authenticated";

revoke delete on table "public"."ag_use_case_stg" from "anon";

revoke insert on table "public"."ag_use_case_stg" from "anon";

revoke references on table "public"."ag_use_case_stg" from "anon";

revoke select on table "public"."ag_use_case_stg" from "anon";

revoke trigger on table "public"."ag_use_case_stg" from "anon";

revoke truncate on table "public"."ag_use_case_stg" from "anon";

revoke update on table "public"."ag_use_case_stg" from "anon";

revoke delete on table "public"."ag_use_case_stg" from "authenticated";

revoke insert on table "public"."ag_use_case_stg" from "authenticated";

revoke references on table "public"."ag_use_case_stg" from "authenticated";

revoke select on table "public"."ag_use_case_stg" from "authenticated";

revoke trigger on table "public"."ag_use_case_stg" from "authenticated";

revoke truncate on table "public"."ag_use_case_stg" from "authenticated";

revoke update on table "public"."ag_use_case_stg" from "authenticated";

revoke delete on table "public"."ag_vendor_stg" from "anon";

revoke insert on table "public"."ag_vendor_stg" from "anon";

revoke references on table "public"."ag_vendor_stg" from "anon";

revoke select on table "public"."ag_vendor_stg" from "anon";

revoke trigger on table "public"."ag_vendor_stg" from "anon";

revoke truncate on table "public"."ag_vendor_stg" from "anon";

revoke update on table "public"."ag_vendor_stg" from "anon";

revoke delete on table "public"."ag_vendor_stg" from "authenticated";

revoke insert on table "public"."ag_vendor_stg" from "authenticated";

revoke references on table "public"."ag_vendor_stg" from "authenticated";

revoke select on table "public"."ag_vendor_stg" from "authenticated";

revoke trigger on table "public"."ag_vendor_stg" from "authenticated";

revoke truncate on table "public"."ag_vendor_stg" from "authenticated";

revoke update on table "public"."ag_vendor_stg" from "authenticated";

revoke delete on table "public"."bfsi_industry_reference" from "anon";

revoke insert on table "public"."bfsi_industry_reference" from "anon";

revoke references on table "public"."bfsi_industry_reference" from "anon";

revoke select on table "public"."bfsi_industry_reference" from "anon";

revoke trigger on table "public"."bfsi_industry_reference" from "anon";

revoke truncate on table "public"."bfsi_industry_reference" from "anon";

revoke update on table "public"."bfsi_industry_reference" from "anon";

revoke delete on table "public"."bfsi_industry_reference" from "authenticated";

revoke insert on table "public"."bfsi_industry_reference" from "authenticated";

revoke references on table "public"."bfsi_industry_reference" from "authenticated";

revoke select on table "public"."bfsi_industry_reference" from "authenticated";

revoke trigger on table "public"."bfsi_industry_reference" from "authenticated";

revoke truncate on table "public"."bfsi_industry_reference" from "authenticated";

revoke update on table "public"."bfsi_industry_reference" from "authenticated";

revoke delete on table "public"."bfsi_industry_reference_stg" from "anon";

revoke insert on table "public"."bfsi_industry_reference_stg" from "anon";

revoke references on table "public"."bfsi_industry_reference_stg" from "anon";

revoke select on table "public"."bfsi_industry_reference_stg" from "anon";

revoke trigger on table "public"."bfsi_industry_reference_stg" from "anon";

revoke truncate on table "public"."bfsi_industry_reference_stg" from "anon";

revoke update on table "public"."bfsi_industry_reference_stg" from "anon";

revoke delete on table "public"."bfsi_industry_reference_stg" from "authenticated";

revoke insert on table "public"."bfsi_industry_reference_stg" from "authenticated";

revoke references on table "public"."bfsi_industry_reference_stg" from "authenticated";

revoke select on table "public"."bfsi_industry_reference_stg" from "authenticated";

revoke trigger on table "public"."bfsi_industry_reference_stg" from "authenticated";

revoke truncate on table "public"."bfsi_industry_reference_stg" from "authenticated";

revoke update on table "public"."bfsi_industry_reference_stg" from "authenticated";

revoke delete on table "public"."bfsi_industry_taxonomy" from "anon";

revoke insert on table "public"."bfsi_industry_taxonomy" from "anon";

revoke references on table "public"."bfsi_industry_taxonomy" from "anon";

revoke trigger on table "public"."bfsi_industry_taxonomy" from "anon";

revoke truncate on table "public"."bfsi_industry_taxonomy" from "anon";

revoke update on table "public"."bfsi_industry_taxonomy" from "anon";

revoke delete on table "public"."bfsi_industry_taxonomy" from "authenticated";

revoke insert on table "public"."bfsi_industry_taxonomy" from "authenticated";

revoke references on table "public"."bfsi_industry_taxonomy" from "authenticated";

revoke trigger on table "public"."bfsi_industry_taxonomy" from "authenticated";

revoke truncate on table "public"."bfsi_industry_taxonomy" from "authenticated";

revoke update on table "public"."bfsi_industry_taxonomy" from "authenticated";

revoke delete on table "public"."bfsi_industry_taxonomy_stg" from "anon";

revoke insert on table "public"."bfsi_industry_taxonomy_stg" from "anon";

revoke references on table "public"."bfsi_industry_taxonomy_stg" from "anon";

revoke select on table "public"."bfsi_industry_taxonomy_stg" from "anon";

revoke trigger on table "public"."bfsi_industry_taxonomy_stg" from "anon";

revoke truncate on table "public"."bfsi_industry_taxonomy_stg" from "anon";

revoke update on table "public"."bfsi_industry_taxonomy_stg" from "anon";

revoke delete on table "public"."bfsi_industry_taxonomy_stg" from "authenticated";

revoke insert on table "public"."bfsi_industry_taxonomy_stg" from "authenticated";

revoke references on table "public"."bfsi_industry_taxonomy_stg" from "authenticated";

revoke select on table "public"."bfsi_industry_taxonomy_stg" from "authenticated";

revoke trigger on table "public"."bfsi_industry_taxonomy_stg" from "authenticated";

revoke truncate on table "public"."bfsi_industry_taxonomy_stg" from "authenticated";

revoke update on table "public"."bfsi_industry_taxonomy_stg" from "authenticated";

revoke delete on table "public"."bfsi_process_ref_rules" from "anon";

revoke insert on table "public"."bfsi_process_ref_rules" from "anon";

revoke references on table "public"."bfsi_process_ref_rules" from "anon";

revoke select on table "public"."bfsi_process_ref_rules" from "anon";

revoke trigger on table "public"."bfsi_process_ref_rules" from "anon";

revoke truncate on table "public"."bfsi_process_ref_rules" from "anon";

revoke update on table "public"."bfsi_process_ref_rules" from "anon";

revoke delete on table "public"."bfsi_process_ref_rules" from "authenticated";

revoke insert on table "public"."bfsi_process_ref_rules" from "authenticated";

revoke references on table "public"."bfsi_process_ref_rules" from "authenticated";

revoke select on table "public"."bfsi_process_ref_rules" from "authenticated";

revoke trigger on table "public"."bfsi_process_ref_rules" from "authenticated";

revoke truncate on table "public"."bfsi_process_ref_rules" from "authenticated";

revoke update on table "public"."bfsi_process_ref_rules" from "authenticated";

revoke delete on table "public"."bfsi_process_reference" from "anon";

revoke insert on table "public"."bfsi_process_reference" from "anon";

revoke references on table "public"."bfsi_process_reference" from "anon";

revoke select on table "public"."bfsi_process_reference" from "anon";

revoke trigger on table "public"."bfsi_process_reference" from "anon";

revoke truncate on table "public"."bfsi_process_reference" from "anon";

revoke update on table "public"."bfsi_process_reference" from "anon";

revoke delete on table "public"."bfsi_process_reference" from "authenticated";

revoke insert on table "public"."bfsi_process_reference" from "authenticated";

revoke references on table "public"."bfsi_process_reference" from "authenticated";

revoke select on table "public"."bfsi_process_reference" from "authenticated";

revoke trigger on table "public"."bfsi_process_reference" from "authenticated";

revoke truncate on table "public"."bfsi_process_reference" from "authenticated";

revoke update on table "public"."bfsi_process_reference" from "authenticated";

revoke delete on table "public"."bfsi_process_reference_stg" from "anon";

revoke insert on table "public"."bfsi_process_reference_stg" from "anon";

revoke references on table "public"."bfsi_process_reference_stg" from "anon";

revoke select on table "public"."bfsi_process_reference_stg" from "anon";

revoke trigger on table "public"."bfsi_process_reference_stg" from "anon";

revoke truncate on table "public"."bfsi_process_reference_stg" from "anon";

revoke update on table "public"."bfsi_process_reference_stg" from "anon";

revoke delete on table "public"."bfsi_process_reference_stg" from "authenticated";

revoke insert on table "public"."bfsi_process_reference_stg" from "authenticated";

revoke references on table "public"."bfsi_process_reference_stg" from "authenticated";

revoke select on table "public"."bfsi_process_reference_stg" from "authenticated";

revoke trigger on table "public"."bfsi_process_reference_stg" from "authenticated";

revoke truncate on table "public"."bfsi_process_reference_stg" from "authenticated";

revoke update on table "public"."bfsi_process_reference_stg" from "authenticated";

revoke delete on table "public"."bfsi_process_taxonomy" from "anon";

revoke insert on table "public"."bfsi_process_taxonomy" from "anon";

revoke references on table "public"."bfsi_process_taxonomy" from "anon";

revoke trigger on table "public"."bfsi_process_taxonomy" from "anon";

revoke truncate on table "public"."bfsi_process_taxonomy" from "anon";

revoke update on table "public"."bfsi_process_taxonomy" from "anon";

revoke delete on table "public"."bfsi_process_taxonomy" from "authenticated";

revoke insert on table "public"."bfsi_process_taxonomy" from "authenticated";

revoke references on table "public"."bfsi_process_taxonomy" from "authenticated";

revoke trigger on table "public"."bfsi_process_taxonomy" from "authenticated";

revoke truncate on table "public"."bfsi_process_taxonomy" from "authenticated";

revoke update on table "public"."bfsi_process_taxonomy" from "authenticated";

revoke delete on table "public"."bfsi_process_taxonomy_stg" from "anon";

revoke insert on table "public"."bfsi_process_taxonomy_stg" from "anon";

revoke references on table "public"."bfsi_process_taxonomy_stg" from "anon";

revoke select on table "public"."bfsi_process_taxonomy_stg" from "anon";

revoke trigger on table "public"."bfsi_process_taxonomy_stg" from "anon";

revoke truncate on table "public"."bfsi_process_taxonomy_stg" from "anon";

revoke update on table "public"."bfsi_process_taxonomy_stg" from "anon";

revoke delete on table "public"."bfsi_process_taxonomy_stg" from "authenticated";

revoke insert on table "public"."bfsi_process_taxonomy_stg" from "authenticated";

revoke references on table "public"."bfsi_process_taxonomy_stg" from "authenticated";

revoke select on table "public"."bfsi_process_taxonomy_stg" from "authenticated";

revoke trigger on table "public"."bfsi_process_taxonomy_stg" from "authenticated";

revoke truncate on table "public"."bfsi_process_taxonomy_stg" from "authenticated";

revoke update on table "public"."bfsi_process_taxonomy_stg" from "authenticated";

revoke delete on table "public"."regulator" from "anon";

revoke insert on table "public"."regulator" from "anon";

revoke references on table "public"."regulator" from "anon";

revoke select on table "public"."regulator" from "anon";

revoke trigger on table "public"."regulator" from "anon";

revoke truncate on table "public"."regulator" from "anon";

revoke update on table "public"."regulator" from "anon";

revoke delete on table "public"."regulator" from "authenticated";

revoke insert on table "public"."regulator" from "authenticated";

revoke references on table "public"."regulator" from "authenticated";

revoke trigger on table "public"."regulator" from "authenticated";

revoke truncate on table "public"."regulator" from "authenticated";

revoke update on table "public"."regulator" from "authenticated";

revoke delete on table "public"."regulator_stg" from "anon";

revoke insert on table "public"."regulator_stg" from "anon";

revoke references on table "public"."regulator_stg" from "anon";

revoke select on table "public"."regulator_stg" from "anon";

revoke trigger on table "public"."regulator_stg" from "anon";

revoke truncate on table "public"."regulator_stg" from "anon";

revoke update on table "public"."regulator_stg" from "anon";

revoke delete on table "public"."regulator_stg" from "authenticated";

revoke insert on table "public"."regulator_stg" from "authenticated";

revoke references on table "public"."regulator_stg" from "authenticated";

revoke select on table "public"."regulator_stg" from "authenticated";

revoke trigger on table "public"."regulator_stg" from "authenticated";

revoke truncate on table "public"."regulator_stg" from "authenticated";

revoke update on table "public"."regulator_stg" from "authenticated";

revoke delete on table "public"."standard" from "anon";

revoke insert on table "public"."standard" from "anon";

revoke references on table "public"."standard" from "anon";

revoke select on table "public"."standard" from "anon";

revoke trigger on table "public"."standard" from "anon";

revoke truncate on table "public"."standard" from "anon";

revoke update on table "public"."standard" from "anon";

revoke delete on table "public"."standard" from "authenticated";

revoke insert on table "public"."standard" from "authenticated";

revoke references on table "public"."standard" from "authenticated";

revoke trigger on table "public"."standard" from "authenticated";

revoke truncate on table "public"."standard" from "authenticated";

revoke update on table "public"."standard" from "authenticated";

revoke delete on table "public"."standard_setter" from "anon";

revoke insert on table "public"."standard_setter" from "anon";

revoke references on table "public"."standard_setter" from "anon";

revoke select on table "public"."standard_setter" from "anon";

revoke trigger on table "public"."standard_setter" from "anon";

revoke truncate on table "public"."standard_setter" from "anon";

revoke update on table "public"."standard_setter" from "anon";

revoke delete on table "public"."standard_setter" from "authenticated";

revoke insert on table "public"."standard_setter" from "authenticated";

revoke references on table "public"."standard_setter" from "authenticated";

revoke trigger on table "public"."standard_setter" from "authenticated";

revoke truncate on table "public"."standard_setter" from "authenticated";

revoke update on table "public"."standard_setter" from "authenticated";

revoke delete on table "public"."standard_setter_stg" from "anon";

revoke insert on table "public"."standard_setter_stg" from "anon";

revoke references on table "public"."standard_setter_stg" from "anon";

revoke select on table "public"."standard_setter_stg" from "anon";

revoke trigger on table "public"."standard_setter_stg" from "anon";

revoke truncate on table "public"."standard_setter_stg" from "anon";

revoke update on table "public"."standard_setter_stg" from "anon";

revoke delete on table "public"."standard_setter_stg" from "authenticated";

revoke insert on table "public"."standard_setter_stg" from "authenticated";

revoke references on table "public"."standard_setter_stg" from "authenticated";

revoke select on table "public"."standard_setter_stg" from "authenticated";

revoke trigger on table "public"."standard_setter_stg" from "authenticated";

revoke truncate on table "public"."standard_setter_stg" from "authenticated";

revoke update on table "public"."standard_setter_stg" from "authenticated";

revoke delete on table "public"."standard_stg" from "anon";

revoke insert on table "public"."standard_stg" from "anon";

revoke references on table "public"."standard_stg" from "anon";

revoke select on table "public"."standard_stg" from "anon";

revoke trigger on table "public"."standard_stg" from "anon";

revoke truncate on table "public"."standard_stg" from "anon";

revoke update on table "public"."standard_stg" from "anon";

revoke delete on table "public"."standard_stg" from "authenticated";

revoke insert on table "public"."standard_stg" from "authenticated";

revoke references on table "public"."standard_stg" from "authenticated";

revoke select on table "public"."standard_stg" from "authenticated";

revoke trigger on table "public"."standard_stg" from "authenticated";

revoke truncate on table "public"."standard_stg" from "authenticated";

revoke update on table "public"."standard_stg" from "authenticated";


  create policy "select_bfsi_industry_taxonomy"
  on "public"."bfsi_industry_taxonomy"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "select_bfsi_process_taxonomy"
  on "public"."bfsi_process_taxonomy"
  as permissive
  for select
  to anon, authenticated
using (true);



