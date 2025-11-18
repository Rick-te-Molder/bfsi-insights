#!/usr/bin/env node
/**
 * Publish Approved Resources
 *
 * Moves approved items from ingestion_queue to kb_resource
 * and populates junction tables for multi-value dimensions.
 *
 * Usage:
 *   node scripts/publishing/publish-approved.mjs [--dry-run] [--limit=10]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Match source slug from domain or name
 */
async function matchSourceSlug(url, sourceName) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');

    const { data } = await supabase
      .from('ref_source')
      .select('slug')
      .or(`domain.eq.${domain},name.ilike.%${sourceName}%`)
      .limit(1)
      .single();

    return data?.slug || null;
  } catch {
    return null;
  }
}

/**
 * Auto-create vendor if it doesn't exist
 */
async function getOrCreateVendorByName(name) {
  if (!name) return null;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data: existing } = await supabase
    .from('ag_vendor')
    .select('id')
    .or(`name_norm.eq.${name.toLowerCase()},slug.eq.${slug}`)
    .single();

  if (existing) return existing.id;

  const { data: newVendor, error } = await supabase
    .from('ag_vendor')
    .insert({ name, slug: slug || `vendor-${Date.now()}` })
    .select('id')
    .single();

  if (error) {
    console.warn(`   ⚠️  Failed to create vendor "${name}": ${error.message}`);
    return null;
  }

  console.log(`   ✨ Auto-created vendor: ${name}`);
  return newVendor.id;
}

/**
 * Auto-create BFSI organization if it doesn't exist
 */
async function getOrCreateOrganizationByName(name) {
  if (!name) return null;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data: existing } = await supabase
    .from('bfsi_organization')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) return existing.id;

  const { data: newOrg, error } = await supabase
    .from('bfsi_organization')
    .insert({ name, slug })
    .select('id')
    .single();

  if (error) {
    console.warn(`   ⚠️  Failed to create organization "${name}": ${error.message}`);
    return null;
  }

  console.log(`   ✨ Auto-created organization: ${name}`);
  return newOrg.id;
}

/**
 * Publish a single approved item to kb_resource + junction tables
 */
async function publishItem(item, dryRun = false) {
  const payload = item.payload;
  const tags = payload.tags || {};

  console.log(`📄 ${payload.title?.substring(0, 60)}...`);

  if (dryRun) {
    console.log(`   [DRY RUN] Would publish with: industry=${tags.industry}, topic=${tags.topic}`);
    return { success: true, dryRun: true };
  }

  // 1. Match source slug from database
  const source_slug = await matchSourceSlug(item.url, payload.source || payload.source_name);

  // 2. Insert into kb_resource
  const { data: resource, error: insertError } = await supabase
    .from('kb_resource')
    .insert({
      title: payload.title,
      author: payload.authors?.join?.(', ') || payload.authors || null,
      date_published: payload.published_at || payload.date_published || null,
      url: item.url,
      source_name: payload.source || payload.source_name || null,
      source_domain: new URL(item.url).hostname,
      source_slug: source_slug,
      slug:
        payload.slug ||
        item.url
          .split('/')
          .pop()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-'),
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
    console.error(`   ❌ Failed to insert: ${insertError.message}`);
    return { success: false, error: insertError.message };
  }

  const resourceId = resource.id;
  console.log(`   ✅ Inserted kb_resource id=${resourceId}`);
  if (source_slug) {
    console.log(`   🏢 Source: ${source_slug}`);
  }

  // 3. Insert into junction tables
  const junctionErrors = [];

  // Industry (support single or array)
  const industries = Array.isArray(tags.industry) ? tags.industry : [tags.industry].filter(Boolean);
  if (industries.length > 0) {
    const { error } = await supabase.from('kb_resource_bfsi_industry').insert(
      industries.map((code, idx) => ({
        resource_id: resourceId,
        industry_code: code,
        rank: idx,
      })),
    );
    if (error) junctionErrors.push(`Industry: ${error.message}`);
    else console.log(`   ✓ Linked ${industries.length} industries`);
  }

  // Topic (support single or array)
  const topics = Array.isArray(tags.topic) ? tags.topic : [tags.topic].filter(Boolean);
  if (topics.length > 0) {
    const { error } = await supabase.from('kb_resource_bfsi_topic').insert(
      topics.map((code, idx) => ({
        resource_id: resourceId,
        topic_code: code,
        rank: idx,
      })),
    );
    if (error) junctionErrors.push(`Topic: ${error.message}`);
    else console.log(`   ✓ Linked ${topics.length} topics`);
  }

  // Vendors (auto-create if needed)
  const vendors = payload.vendors || [];
  if (vendors.length > 0) {
    for (const [idx, vendorName] of vendors.entries()) {
      const vendorId = await getOrCreateVendorByName(vendorName);
      if (vendorId) {
        await supabase
          .from('kb_resource_ag_vendor')
          .insert({ resource_id: resourceId, vendor_id: vendorId, rank: idx });
      }
    }
    console.log(`   ✓ Linked ${vendors.length} vendors`);
  }

  // Organizations (auto-create if needed)
  const organizations = payload.organizations || [];
  if (organizations.length > 0) {
    for (const [idx, orgName] of organizations.entries()) {
      const orgId = await getOrCreateOrganizationByName(orgName);
      if (orgId) {
        await supabase
          .from('kb_resource_bfsi_organization')
          .insert({ resource_id: resourceId, organization_id: orgId, rank: idx });
      }
    }
    console.log(`   ✓ Linked ${organizations.length} organizations`);
  }

  // 3. Mark queue item as published
  await supabase
    .from('ingestion_queue')
    .update({ status: 'published', reviewed_at: new Date().toISOString() })
    .eq('id', item.id);

  if (junctionErrors.length > 0) {
    console.warn(`   ⚠️  Junction table warnings: ${junctionErrors.join(', ')}`);
  }

  return { success: true, resourceId, junctionErrors };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1]) || 100;

  console.log('🚀 Publishing approved resources...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Fetch approved items
  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status', 'approved')
    .limit(limit)
    .order('reviewed_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to fetch approved items:', error.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('✅ No approved items to publish');
    return;
  }

  console.log(`Found ${items.length} approved items\n`);

  let published = 0;
  let failed = 0;

  for (const item of items) {
    const result = await publishItem(item, dryRun);
    if (result.success) {
      published++;
    } else {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 100)); // Rate limit
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Published: ${published}`);
  console.log(`   Failed: ${failed}`);

  if (!dryRun) {
    console.log(`\n✨ Complete! Run 'npm run build:resources' to rebuild the site.`);
  }
}

main().catch(console.error);
