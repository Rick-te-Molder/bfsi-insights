import process from 'node:process';

const REQUEST_DELAY_MS = Number(process.env.SITEMAP_RATE_LIMIT_MS) || 1000;
let lastRequestTime = 0;

export function triggerRateLimitForTesting() {
  lastRequestTime = Date.now();
}

export function clearRateLimitForTesting() {
  lastRequestTime = 0;
}

export async function enforceRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}
