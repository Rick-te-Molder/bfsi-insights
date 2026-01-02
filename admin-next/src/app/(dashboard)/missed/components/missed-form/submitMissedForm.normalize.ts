export function normalizeUrl(url: string) {
  const urlObj = new URL(url);
  return {
    urlNorm: (urlObj.origin + urlObj.pathname).toLowerCase(),
    domain: urlObj.hostname.replace(/^www\./, ''),
  };
}
