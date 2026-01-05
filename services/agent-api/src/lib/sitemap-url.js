function hasYearInPath(url) {
  return /\/(20\d{2})\//i.test(url);
}

function hasArticleLikePath(url) {
  return /\/(article|blog|news|post|insight|report|publication|research)\//i.test(url);
}

function hasHtmlExtension(url) {
  return /\.(html|htm)$/i.test(url);
}

function isExcludedAsset(url) {
  return /\.(pdf|jpg|png|gif|css|js|xml|json)$/i.test(url);
}

function isExcludedPath(url) {
  return /\/(tag|category|author|page|feed|wp-content|assets|static)\//i.test(url);
}

export function createSitemapUrlFilter({ keywords = [] } = {}) {
  const normalizedKeywords = keywords.map((kw) => kw.toLowerCase());

  return (url) => {
    if (isExcludedPath(url) || isExcludedAsset(url)) return false;
    if (hasArticleLikePath(url) || hasYearInPath(url) || hasHtmlExtension(url)) return true;

    if (normalizedKeywords.length === 0) return true;
    const urlLower = url.toLowerCase();
    return normalizedKeywords.some((kw) => urlLower.includes(kw));
  };
}

export function extractTitleFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const slug = segments.at(-1) || '';

    if (!slug) return '';

    return slug
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replaceAll(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return 'Untitled';
  }
}
