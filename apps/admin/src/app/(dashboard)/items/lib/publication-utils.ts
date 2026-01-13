export interface PublicationData {
  title: string;
  slug: string;
  sourceUrl: string;
  sourceName: string;
  sourceDomain: string;
  datePublished: string;
  summaryShort: string;
  summaryMedium: string;
  summaryLong: string;
  thumbnailUrl: string | null;
  thumbnailBucket: string | null;
  thumbnailPath: string | null;
}

function isoNow(): string {
  return new Date().toISOString();
}

function toIsoOrNow(date: Date): string {
  return Number.isNaN(date.getTime()) ? isoNow() : date.toISOString();
}

function normalizeDatePublished(input: unknown): string {
  if (!input) return isoNow();
  const raw = String(input).trim();
  if (!raw) return isoNow();

  if (/^\d{4}-\d{2}$/.test(raw)) return toIsoOrNow(new Date(`${raw}-01`));
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return toIsoOrNow(new Date(raw));

  const dmY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (dmY) {
    const year = dmY[3].length === 2 ? 2000 + Number(dmY[3]) : Number(dmY[3]);
    const yyyy = String(year).padStart(4, '0');
    const mm = String(Number(dmY[2])).padStart(2, '0');
    const dd = String(Number(dmY[1])).padStart(2, '0');
    return toIsoOrNow(new Date(`${yyyy}-${mm}-${dd}`));
  }

  return toIsoOrNow(new Date(raw));
}

export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export function buildPublicStorageUrl(
  bucket: string | null | undefined,
  path: string | null | undefined,
): string | null {
  if (!bucket || !path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-)|(-$)/g, '')
    .slice(0, 80);
}

export function preparePublicationData(
  item: { url: string; payload: Record<string, unknown> },
  title: string,
): PublicationData {
  const payload = item.payload || {};
  const summary = (payload.summary || {}) as Record<string, unknown>;
  const sourceDomain = extractDomain(item.url);
  const sourceFromPayload = (payload.source_name || payload.source || payload.source_slug) as
    | string
    | undefined;

  const thumbnailBucket = (payload.thumbnail_bucket as string | null | undefined) ?? null;
  const thumbnailPath = (payload.thumbnail_path as string | null | undefined) ?? null;
  const thumbnailUrl =
    (payload.thumbnail_url as string | null | undefined) ??
    buildPublicStorageUrl(thumbnailBucket, thumbnailPath) ??
    null;

  return {
    title,
    slug: `${generateSlug(title)}-${Date.now()}`,
    sourceUrl: item.url,
    sourceName:
      sourceFromPayload && sourceFromPayload !== 'manual' ? sourceFromPayload : sourceDomain,
    sourceDomain,
    datePublished: normalizeDatePublished(payload.published_at ?? payload.date_published),
    summaryShort: (summary.short as string) || '',
    summaryMedium: (summary.medium as string) || '',
    summaryLong: (summary.long as string) || '',
    thumbnailUrl,
    thumbnailBucket,
    thumbnailPath,
  };
}
