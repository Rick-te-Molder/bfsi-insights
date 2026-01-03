#!/usr/bin/env node
/**
 * Check for stale items in enrichment pipeline
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Check items in enrichment statuses (200-239)
  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code, payload, discovered_at, fetched_at')
    .gte('status_code', 200)
    .lt('status_code', 240)
    .order('discovered_at', { ascending: true });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`\nFound ${items.length} items in enrichment statuses:\n`);

  for (const item of items) {
    // Get last status change from status_history
    const { data: lastChange } = await supabase
      .from('status_history')
      .select('changed_at, to_status')
      .eq('queue_id', item.id)
      .order('changed_at', { ascending: false })
      .limit(1)
      .single();

    const age = Math.round(
      (Date.now() - new Date(item.discovered_at).getTime()) / (1000 * 60 * 60),
    );
    const lastChangeAge = lastChange
      ? Math.round((Date.now() - new Date(lastChange.changed_at).getTime()) / (1000 * 60))
      : null;

    console.log(`ID: ${item.id}`);
    console.log(`  Status: ${item.status_code}`);
    console.log(`  URL: ${item.url?.substring(0, 80)}...`);
    console.log(`  Title: ${item.payload?.title?.substring(0, 60) || 'N/A'}`);
    console.log(`  Age: ${age}h`);
    console.log(
      `  Last status change: ${lastChangeAge !== null ? `${lastChangeAge}m ago` : 'N/A'}`,
    );
    console.log('');
  }
}

main();
