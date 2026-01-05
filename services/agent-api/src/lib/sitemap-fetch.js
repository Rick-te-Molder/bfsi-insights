import { enforceRateLimit } from './sitemap-rate-limit.js';

export async function fetchWithPoliteness(url) {
  await enforceRateLimit();

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BFSI-Insights-Bot/1.0 (+https://bfsi-insights.dev; crawler)',
      Accept: 'application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

export async function fetchHtml(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BFSIInsightsBot/1.0; +https://bfsiinsights.com)',
        Accept: 'text/html',
      },
    });

    if (!response.ok) return null;
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
