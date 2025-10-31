#!/usr/bin/env node
import fs from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const FILE = 'src/data/resources/resources.json';
const CONCURRENCY = 5;
const TIMEOUT_MS = 10000;
const RETRIES = 2;
const SKIP_PATTERNS = [
  // Add patterns to skip domains if needed, e.g. /example\.com/,
];

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
      const res = await fetch(url, { method, redirect: 'follow', signal });
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

  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < urls.length) {
      const current = idx++;
      const url = urls[current];
      if (shouldSkip(url)) continue;
      const res = await check(url);
      if (!res.ok) failures.push({ url, error: res.error });
    }
  });
  await Promise.all(workers);

  if (failures.length) {
    console.error(`Broken links (${failures.length}):`);
    for (const f of failures) console.error(` - ${f.url} :: ${f.error}`);
    process.exit(1);
  } else {
    console.log(`All ${urls.length} links OK`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
