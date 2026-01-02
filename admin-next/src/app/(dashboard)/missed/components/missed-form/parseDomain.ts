export function parseDomainFromUrl(url: string) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
