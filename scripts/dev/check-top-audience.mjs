#!/usr/bin/env node
/**
 * @script check-top-audience.mjs
 * @safety SAFE
 * @env local
 *
 * @description
 * Read-only validation across pipeline + published items to ensure the "top audience"
 * is consistent:
 * - Pipeline: compute top audience from ingestion_queue.payload using taxonomy_config scoring fields
 * - Published: compare kb_publication.audience to the top-scoring row in kb_publication_audience
 *
 * @sideEffects
 * - None (read-only)
 *
 * @rollback
 * - N/A
 *
 * @usage
 *   node scripts/dev/check-top-audience.mjs --limit-pipeline=5000 --limit-published=5000 --min-score=0.5 --sample=25
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFromFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) return;
    if (process.env[key] == null) process.env[key] = value;
  });
}

function loadEnv() {
  const envCandidates = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../apps/admin/.env.local'),
    path.join(__dirname, '../../services/agent-api/.env.local'),
  ];

  for (const envPath of envCandidates) {
    loadEnvFromFile(envPath);
  }
}

loadEnv();

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function getArgInt(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return fallback;
  const raw = arg.slice(prefix.length);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getArgFloat(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return fallback;
  const raw = arg.slice(prefix.length);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const supabaseUrl =
  process.env.PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  getRequiredEnv('PUBLIC_SUPABASE_URL');
const supabaseKey = getRequiredEnv('SUPABASE_SERVICE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

function getPayloadValue(payload, fieldPath) {
  const parts = fieldPath.split('.');
  let value = payload;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }
  return value;
}

function getAudienceCodeFromPayloadField(payloadField) {
  const parts = payloadField.split('.');
  return parts[parts.length - 1] || null;
}

function computeTopAudienceFromPayload({ payload, audienceConfigs, minScore }) {
  const scored = [];

  for (const config of audienceConfigs) {
    const score = getPayloadValue(payload, config.payload_field);
    const code = getAudienceCodeFromPayloadField(config.payload_field);
    if (typeof score === 'number' && Number.isFinite(score) && score >= minScore && code) {
      scored.push({ code, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0] ?? null;
  const second = scored[1] ?? null;
  return { top, second, totalQualified: scored.length };
}

function computeFirstQualifyingAudienceFromPayload({ payload, audienceConfigs, minScore }) {
  for (const config of audienceConfigs) {
    const score = getPayloadValue(payload, config.payload_field);
    const code = getAudienceCodeFromPayloadField(config.payload_field);
    if (typeof score === 'number' && Number.isFinite(score) && score >= minScore && code) {
      return { code, score };
    }
  }
  return null;
}

async function fetchAll({ table, select, limit, pageSize = 1000, filters = [] }) {
  const rows = [];
  let offset = 0;

  while (rows.length < limit) {
    const take = Math.min(pageSize, limit - rows.length);
    let query = supabase
      .from(table)
      .select(select)
      .range(offset, offset + take - 1);

    for (const f of filters) {
      query = f(query);
    }

    const { data, error } = await query;
    if (error) throw new Error(`${table} query failed: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...data);
    offset += data.length;

    if (data.length < take) break;
  }

  return rows;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const limitPipeline = getArgInt('limit-pipeline', 5000);
  const limitPublished = getArgInt('limit-published', 5000);
  const minScore = getArgFloat('min-score', 0.5);
  const sample = getArgInt('sample', 25);

  console.log('🔎 Top audience validation (read-only)');
  console.log(`- supabaseUrl: ${supabaseUrl}`);
  console.log(`- limitPipeline: ${limitPipeline}`);
  console.log(`- limitPublished: ${limitPublished}`);
  console.log(`- minScore: ${minScore}`);
  console.log('');

  const { data: audienceConfigs, error: cfgErr } = await supabase
    .from('taxonomy_config')
    .select('slug, payload_field, behavior_type, score_parent_slug, is_active, display_order')
    .eq('is_active', true)
    .eq('behavior_type', 'scoring')
    .eq('score_parent_slug', 'audience')
    .order('display_order');

  if (cfgErr) throw new Error(`taxonomy_config fetch failed: ${cfgErr.message}`);

  const configs = audienceConfigs || [];
  console.log(`Loaded ${configs.length} audience scoring configs`);
  if (configs.length === 0) {
    console.log('No audience configs found; aborting');
    process.exit(1);
  }

  console.log('\n=== Pipeline (ingestion_queue) ===');
  const pipelineRows = await fetchAll({
    table: 'ingestion_queue',
    select: 'id, url, status_code, payload',
    limit: limitPipeline,
  });

  let pipelineWithTop = 0;
  let pipelineNoTop = 0;
  let pipelineMultiQualified = 0;
  let pipelineOldVsNewMismatch = 0;
  const pipelineMismatchSamples = [];

  for (const row of pipelineRows) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const { top, totalQualified } = computeTopAudienceFromPayload({
      payload,
      audienceConfigs: configs,
      minScore,
    });

    const oldFirst = computeFirstQualifyingAudienceFromPayload({
      payload,
      audienceConfigs: configs,
      minScore,
    });

    if (top) pipelineWithTop += 1;
    else pipelineNoTop += 1;

    if (totalQualified >= 2) pipelineMultiQualified += 1;

    if (top && oldFirst && top.code !== oldFirst.code) {
      pipelineOldVsNewMismatch += 1;
      if (pipelineMismatchSamples.length < sample) {
        pipelineMismatchSamples.push({
          id: row.id,
          url: row.url,
          status_code: row.status_code,
          old_code: oldFirst.code,
          old_score: oldFirst.score,
          top_code: top.code,
          top_score: top.score,
        });
      }
    }
  }

  console.log(`Scanned pipeline items: ${pipelineRows.length}`);
  console.log(`- with top audience (>= ${minScore}): ${pipelineWithTop}`);
  console.log(`- without qualifying audience: ${pipelineNoTop}`);
  console.log(`- with >=2 qualifying audiences: ${pipelineMultiQualified}`);
  console.log(`- old-vs-correct top audience mismatches: ${pipelineOldVsNewMismatch}`);

  if (pipelineMismatchSamples.length > 0) {
    console.log(`\nSample pipeline mismatches (up to ${sample}):`);
    pipelineMismatchSamples.forEach((m) => {
      console.log(
        `- queue=${m.id} status=${m.status_code} old=${m.old_code}(${m.old_score}) top=${m.top_code}(${m.top_score}) url=${m.url}`,
      );
    });
  }

  console.log('\n=== Published (kb_publication / kb_publication_audience) ===');

  const publishedRows = await fetchAll({
    table: 'kb_publication',
    select: 'id, source_url, title, audience, status, origin_queue_id',
    limit: limitPublished,
    filters: [(q) => q.eq('status', 'published')],
  });

  const pubsWithOrigin = publishedRows.filter((p) => typeof p.origin_queue_id === 'string');
  const originIds = pubsWithOrigin.map((p) => p.origin_queue_id);

  const originPayloadById = new Map();
  const originChunks = chunkArray(originIds, 500);
  for (const chunk of originChunks) {
    const { data, error } = await supabase
      .from('ingestion_queue')
      .select('id, payload')
      .in('id', chunk);
    if (error) throw new Error(`ingestion_queue origin payload fetch failed: ${error.message}`);
    for (const row of data || []) {
      originPayloadById.set(row.id, row.payload);
    }
  }

  const mismatches = [];
  let missingOriginQueueId = 0;
  let missingOriginPayload = 0;
  let noQualifiedAudience = 0;
  let totalChecked = 0;

  for (const pub of publishedRows) {
    totalChecked += 1;
    const originQueueId = typeof pub.origin_queue_id === 'string' ? pub.origin_queue_id : null;
    if (!originQueueId) {
      missingOriginQueueId += 1;
      continue;
    }

    const payload = originPayloadById.get(originQueueId);
    if (!payload || typeof payload !== 'object') {
      missingOriginPayload += 1;
      continue;
    }

    const { top } = computeTopAudienceFromPayload({
      payload,
      audienceConfigs: configs,
      minScore,
    });

    if (!top) {
      noQualifiedAudience += 1;
      continue;
    }

    const stored = pub.audience;

    if (stored !== top.code) {
      mismatches.push({
        publication_id: pub.id,
        stored_audience: stored,
        computed_top_audience: top.code,
        computed_top_score: top.score,
        source_url: pub.source_url,
        title: pub.title,
        origin_queue_id: originQueueId,
      });
    }
  }

  console.log(`Scanned published items: ${totalChecked}`);
  console.log(`- missing origin_queue_id: ${missingOriginQueueId}`);
  console.log(`- missing origin payload in ingestion_queue: ${missingOriginPayload}`);
  console.log(
    `- no qualifying audience in origin payload (>= ${minScore}): ${noQualifiedAudience}`,
  );
  console.log(`- mismatches (kb_publication.audience vs computed top score): ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.log(`\nSample mismatches (up to ${sample}):`);
    mismatches.slice(0, sample).forEach((m) => {
      console.log(
        `- pub=${m.publication_id} stored=${m.stored_audience} computed=${m.computed_top_audience} score=${m.computed_top_score} origin=${m.origin_queue_id} url=${m.source_url}`,
      );
    });

    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
