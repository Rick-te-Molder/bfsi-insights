import { fetchWithPoliteness } from './sitemap-fetch.js';

function parseRobotsLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const [directive, ...valueParts] = trimmed.split(':');
  return { directive: directive.toLowerCase(), value: valueParts.join(':').trim() };
}

function createEmptyRobotsResult() {
  return { sitemaps: [], disallowPatterns: [], crawlDelay: null };
}

function updateUserAgentState(parsed) {
  return {
    inUserAgentBlock: true,
    appliesToUs: parsed.value === '*' || parsed.value.toLowerCase().includes('bfsi'),
  };
}

function applyRobotsDirective(result, state, parsed) {
  if (parsed.directive === 'sitemap') result.sitemaps.push(parsed.value);
  if (!state.inUserAgentBlock || !state.appliesToUs) return;
  if (parsed.directive === 'disallow' && parsed.value) result.disallowPatterns.push(parsed.value);
  if (parsed.directive === 'crawl-delay')
    result.crawlDelay = Number.parseInt(parsed.value, 10) || null;
}

export async function checkRobotsTxt(domain) {
  try {
    const text = await fetchWithPoliteness(`https://${domain}/robots.txt`);
    const result = createEmptyRobotsResult();
    let state = { inUserAgentBlock: false, appliesToUs: false };

    for (const line of text.split('\n')) {
      const parsed = parseRobotsLine(line);
      if (!parsed) continue;
      if (parsed.directive === 'user-agent') state = updateUserAgentState(parsed);
      else applyRobotsDirective(result, state, parsed);
    }

    return result;
  } catch {
    return createEmptyRobotsResult();
  }
}

function matchesWildcard(pathname, pattern) {
  const regex = new RegExp('^' + pattern.replaceAll('*', '.*') + '$');
  return regex.test(pathname);
}

export function isUrlAllowed(url, disallowPatterns) {
  if (!disallowPatterns || disallowPatterns.length === 0) return true;

  try {
    const pathname = new URL(url).pathname;

    for (const pattern of disallowPatterns) {
      if (pathname.startsWith(pattern)) return false;
      if (pattern.includes('*') && matchesWildcard(pathname, pattern)) return false;
    }

    return true;
  } catch {
    return true;
  }
}
