export function formatDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractCode(item: any): string | null {
  if (!item) return null;
  return typeof item === 'string' ? item : item.code || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractCodes(arr: any[] | null | undefined): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map(extractCode).filter((code): code is string => code !== null);
}

export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
