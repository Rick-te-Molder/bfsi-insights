#!/usr/bin/env node

/**
 * Publish Approved Items
 *
 * Moves approved rows from ingestion_queue → kb_publication
 * and populates all junction tables (industry, topic, vendor, org, process).
 *
 * Usage:
 *   node scripts/publishing/publish-approved.mjs [--dry-run] [--limit=10]
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// -------------------------------------------------------------
// Utility helpers
// -------------------------------------------------------------

function normaliseSlug(str) {
  if (!str) return null;
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function safeArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function safeString(x) {
  if (x == null) return null;
  return String(x).trim();
}

// -------------------------------------------------------------
// Match kb_source entry from URL or source_name
// -------------------------------------------------------------
async function matchSourceSlug(url, sourceName) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const sourceNameLc = (sourceName || '').toLowerCase();

    const { data } = await supabase
      .from('kb_source')
      .select('code')
      .or(`domain.eq.${domain},name.ilike.%${sourceNameLc}%`)
      .limit(1)
      .single();

    return data?.code || null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Auto-create vendor on demand
// -------------------------------------------------------------
async function getOrCreateVendor(name) {
  if (!name) return null;

  const slug = normaliseSlug(name);

  const { data: existing } = await supabase
    .from('ag_vendor')
    .select('id')
    .or(`name_norm.eq.${name.toLowerCase()},slug.eq.${slug}`)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newVendor, error } = await supabase
    .from('ag_vendor')
    .insert({ name, slug })
    .select('id')
    .single();

  if (error) {
    console.warn(`   ⚠ Failed to create vendor "${name}": ${error.message}`);
    return null;
  }

  console.log(`   ✨ Created vendor: ${name}`);
  return newVendor.id;
}

// -------------------------------------------------------------
// Auto-create BFSI organization
// -------------------------------------------------------------
async function getOrCreateOrg(name) {
  if (!name) return null;

  const slug = normaliseSlug(name);

  const { data: existing } = await supabase
    .from('bfsi_organization')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newOrg, error } = await supabase
    .from('bfsi_organization')
    .insert({ name, slug })
    .select('id')
    .single();

  if (error) {
    console.warn(`   ⚠ Failed to create org "${name}": ${error.message}`);
    return null;
  }

  console.log(`   ✨ Created organization: ${name}`);
  return newOrg.id;
}

// -------------------------------------------------------------
// Publish one item
// -------------------------------------------------------------
async function publishItem(item, dryRun = false) {
  const payload = item.payload || {};
  const tags = payload.tags || {};

  console.log(`📄 ${safeString(payload.title)?.slice(0, 70)}`);

  if (dryRun) {
    console.log(`   [DRY RUN] Would publish.`);
    return { success: true, dryRun: true };
  }

  // ---- 1. Source matching ----
  const sourceSlug = await matchSourceSlug(item.url, payload.source || payload.source_name);

  // ---- 2. Insert publication ----
  const { data: inserted, error: insertError } = await supabase
    .from('kb_publication')
    .insert({
      title: safeString(payload.title),
      author: safeArray(payload.authors).join(', '),
      date_published: payload.published_at || payload.date_published || null,
      url: safeString(item.url),
      source_name: payload.source || payload.source_name || null,
      source_domain: new URL(item.url).hostname,
      source_slug: sourceSlug,
      slug: payload.slug || normaliseSlug(item.url.split('/').pop()) || `item-${Date.now()}`,
      summary_short: payload.summary?.short || null,
      summary_medium: payload.summary?.medium || null,
      summary_long: payload.summary?.long || null,
      role: tags.role || 'researcher',
      content_type: tags.content_type || 'article',
      geography: tags.geography || 'global',
      thumbnail: item.thumb_ref || null,
      status: 'published',
      tags: payload.tags || null,
      use_cases: tags.use_cases || null,
      agentic_capabilities: tags.agentic_capabilities || null,
      origin_queue_id: item.id,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error(`   ❌ Insert failed: ${insertError.message}`);
    return { success: false };
  }

  const publicationId = inserted.id;
  console.log(`   ✅ Published as id=${publicationId}`);

  // ---- 3. Junction tables ----
  const junctionErrors = [];

  // INDUSTRY
  const industries = safeArray(tags.industry).filter(Boolean);
  if (industries.length > 0) {
    const { error } = await supabase.from('kb_publication_bfsi_industry').insert(
      industries.map((code, idx) => ({
        publication_id: publicationId,
        industry_code: code,
        rank: idx,
      })),
    );
    if (error) junctionErrors.push(error.message);
  }

  // TOPIC
  const topics = safeArray(tags.topic).filter(Boolean);
  if (topics.length > 0) {
    const { error } = await supabase.from('kb_publication_bfsi_topic').insert(
      topics.map((code, idx) => ({
        publication_id: publicationId,
        topic_code: code,
        rank: idx,
      })),
    );
    if (error) junctionErrors.push(error.message);
  }

  // VENDORS
  const vendors = safeArray(payload.vendors);
  for (const [idx, name] of vendors.entries()) {
    const vid = await getOrCreateVendor(name);
    if (vid) {
      await supabase
        .from('kb_publication_ag_vendor')
        .insert({ publication_id: publicationId, vendor_id: vid, rank: idx });
    }
  }

  // ORGANIZATIONS
  const orgs = safeArray(payload.organizations);
  for (const [idx, name] of orgs.entries()) {
    const oid = await getOrCreateOrg(name);
    if (oid) {
      await supabase.from('kb_publication_bfsi_organization').insert({
        publication_id: publicationId,
        organization_id: oid,
        rank: idx,
      });
    }
  }

  if (junctionErrors.length > 0) {
    console.warn(`   ⚠ Junction warnings: ${junctionErrors.join(', ')}`);
  }

  // ---- 4. Mark queue item as published ----
  await supabase
    .from('ingestion_queue')
    .update({ status: 'published', reviewed_at: new Date().toISOString() })
    .eq('id', item.id);

  return { success: true, publicationId };
}

// -------------------------------------------------------------
// Main
// -------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1]) || 100;

  console.log(`🚀 Publishing approved items (${dryRun ? 'DRY RUN' : 'LIVE'})\n`);

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('❌ Cannot load approved items:', error.message);
    process.exit(1);
  }

  if (!items?.length) {
    console.log('✓ Nothing to publish');
    return;
  }

  console.log(`Found ${items.length} items\n`);

  let published = 0;
  let failed = 0;

  for (const item of items) {
    const result = await publishItem(item, dryRun);
    if (result.success) published++;
    else failed++;

    await new Promise((r) => setTimeout(r, 120)); // rate limit safety
  }

  console.log(`\n📊 Summary`);
  console.log(`   Published: ${published}`);
  console.log(`   Failed:    ${failed}`);

  if (!dryRun) {
    console.log(`\n✨ Done. Publications are now live on the website.`);
  }
}

main().catch((e) => console.error(e));
