#!/usr/bin/env node
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const CONCURRENCY = 5;
const TIMEOUT_MS = 15000;
const RETRIES = 3;
const SKIP_PATTERNS = [
  // Add patterns to skip domains if needed, e.g. /example\.com/,
];
const SOFT_FAIL_DOMAINS_DEFAULT = [/mckinsey\.com/, /openai\.com/, /medium\.com/];
function parseSoftFailDomains() {
  const env = process.env.SOFT_FAIL_DOMAINS;
  if (!env) return SOFT_FAIL_DOMAINS_DEFAULT;
  const extra = env
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new RegExp(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return [...SOFT_FAIL_DOMAINS_DEFAULT, ...extra];
}
const SOFT_FAIL_DOMAINS = parseSoftFailDomains();
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; BFSIInsightsLinkChecker/1.0; +https://www.bfsiinsights.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const controllerWithTimeout = (ms) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, cancel: () => clearTimeout(t) };
};

function shouldSkip(url) {
  return SKIP_PATTERNS.some((re) => re.test(url));
}

async function headOrGet(url) {
  // Some sites block HEAD or return 405; try HEAD then GET.
  for (const method of ['HEAD', 'GET']) {
    const { signal, cancel } = controllerWithTimeout(TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal, headers: HEADERS });
      cancel();
      return res;
    } catch (e) {
      cancel();
      if (method === 'GET') throw e;
    }
  }
}

async function check(url) {
  let lastErr = null;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const res = await headOrGet(url);
      const ok = res.status >= 200 && res.status < 400;
      if (ok) return { ok: true, status: res.status };
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await delay(300 * (i + 1));
  }
  return { ok: false, error: lastErr?.message || 'Unknown error' };
}

async function main() {
  console.log('🔗 Checking links for published publications...\n');

  // Fetch all published publications from Supabase
  const { data: publications, error } = await supabase
    .from('kb_publication')
    .select('id, slug, title, source_url')
    .eq('status', 'published');

  if (error) {
    console.error('Failed to fetch publications:', error.message);
    process.exit(1);
  }

  if (!publications || publications.length === 0) {
    console.log('No published publications found.');
    return;
  }

  console.log(`Checking ${publications.length} publications...\n`);
  const urls = publications
    .map((p) => ({ url: p.source_url, title: p.title, slug: p.slug }))
    .filter((p) => p.url);
  const failures = [];
  const softFailures = [];

  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < urls.length) {
      const current = idx++;
      const item = urls[current];
      const url = item.url;
      if (shouldSkip(url)) continue;
      const res = await check(url);
      if (!res.ok) {
        const failureData = { url, title: item.title, slug: item.slug, error: res.error };
        if (SOFT_FAIL_DOMAINS.some((re) => re.test(url))) softFailures.push(failureData);
        else failures.push(failureData);
      }
    }
  });
  await Promise.all(workers);

  if (failures.length || softFailures.length) {
    if (failures.length) {
      console.error(`\n❌ Broken links (${failures.length}):`);
      for (const f of failures) {
        console.error(`   ${f.title}`);
        console.error(`   URL: ${f.url}`);
        console.error(`   Error: ${f.error}`);
        console.error(`   Slug: ${f.slug}`);
        console.error('');
      }
    }
    if (softFailures.length) {
      console.warn(`\n⚠️  Soft-failed links (${softFailures.length}) [non-blocking]:`);
      for (const f of softFailures) {
        console.warn(`   ${f.title}`);
        console.warn(`   URL: ${f.url}`);
        console.warn(`   Error: ${f.error}`);
        console.warn('');
      }
    }
    process.exit(failures.length ? 1 : 0);
  } else {
    console.log(`\n✅ All ${urls.length} links OK`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
