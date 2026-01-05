/**
 * PublicationCard Utility Functions
 *
 * Helper functions for formatting, processing, and displaying publication card data.
 */

/** Format ISO date string to readable format */
export const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

/** Ensure value is always an array */
export const asArray = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
};

/** Strip redundant source suffix from title */
export const stripSourceFromTitle = (title: string, sourceName?: string | null): string => {
  if (!sourceName) return title;
  const separators = ['|', '-', '—', '–', ':'];
  for (const sep of separators) {
    const suffix = `${sep} ${sourceName}`;
    if (title.endsWith(suffix)) return title.slice(0, -suffix.length).trim();
    const suffixNoSpace = `${sep}${sourceName}`;
    if (title.endsWith(suffixNoSpace)) return title.slice(0, -suffixNoSpace.length).trim();
  }
  return title;
};

/** Expand thumbnail path to candidate URLs */
export const expandItemThumb = (t?: string): string[] => {
  if (!t) return [];
  if (/\.(webp|png|jpe?g)$/i.test(t)) return [t];
  if (t.startsWith('http://') || t.startsWith('https://')) return [t];
  return [`${t}.webp`, `${t}.png`, `${t}.jpg`];
};

/** Filter to show only deepest (leaf) tags - exclude parent tags when children exist */
export const getDeepestTags = (tags: string[]): string[] => {
  if (!tags || tags.length === 0) return [];
  return tags.filter((tag) => !tags.some((other) => other !== tag && other.startsWith(tag + '-')));
};

/** Check if date is within the last N days */
export const isWithinDays = (dateStr: string | null | undefined, days: number): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !Number.isNaN(date.getTime()) && (Date.now() - date.getTime()) / 86400000 <= days;
};

interface TagCounts {
  audiences: string[];
  deepestGeographies: string[];
  deepestIndustries: string[];
  topics: string[];
  contentTypes: string[];
  regulators: string[];
  regulations: string[];
  obligations: string[];
  deepestProcesses: string[];
}

/** Calculate extra tag count for +N indicator */
export const calculateExtraTagCount = (tags: TagCounts): number => {
  return (
    Math.max(0, tags.audiences.length - 1) +
    Math.max(0, tags.deepestGeographies.length - 1) +
    tags.deepestIndustries.length +
    tags.topics.length +
    tags.contentTypes.length +
    tags.regulators.length +
    tags.regulations.length +
    tags.obligations.length +
    tags.deepestProcesses.length
  );
};

/** Build thumbnail URL from path and bucket */
export const buildThumbnailUrl = (
  thumbnailPath?: string | null,
  thumbnailBucket?: string | null,
  supabaseUrl?: string,
): string | null => {
  if (!thumbnailPath || !thumbnailBucket || !supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${thumbnailBucket}/${thumbnailPath}`;
};
