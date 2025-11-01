#!/usr/bin/env node
import fs from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const FILE = 'src/data/resources/resources.json';
const CONCURRENCY = 5;
const TIMEOUT_MS = 15000;
const RETRIES = 3;
const SKIP_PATTERNS = [
  // Add patterns to skip domains if needed, e.g. /example\.com/,
];
const SOFT_FAIL_DOMAINS_DEFAULT = [/mckinsey\.com/];
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
  const raw = await fs.readFile(FILE, 'utf8');
  const items = JSON.parse(raw);
  const urls = items.map((i) => i.url).filter(Boolean);
  const failures = [];
  const softFailures = [];

  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < urls.length) {
      const current = idx++;
      const url = urls[current];
      if (shouldSkip(url)) continue;
      const res = await check(url);
      if (!res.ok) {
        if (SOFT_FAIL_DOMAINS.some((re) => re.test(url)))
          softFailures.push({ url, error: res.error });
        else failures.push({ url, error: res.error });
      }
    }
  });
  await Promise.all(workers);

  if (failures.length || softFailures.length) {
    if (failures.length) {
      console.error(`Broken links (${failures.length}):`);
      for (const f of failures) console.error(` - ${f.url} :: ${f.error}`);
    }
    if (softFailures.length) {
      console.warn(`Soft-failed links (${softFailures.length}) [non-blocking]:`);
      for (const f of softFailures) console.warn(` - ${f.url} :: ${f.error}`);
    }
    process.exit(failures.length ? 1 : 0);
  } else {
    console.log(`All ${urls.length} links OK`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
