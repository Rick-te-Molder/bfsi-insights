export const toAscii = (s) => (s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
export const slug = (s) =>
  toAscii((s || '').toLowerCase())
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const lastName = (full) => {
  if (!full) return 'unknown';
  const parts = full.trim().split(/\s+/);
  const low = parts.map((x) => x.toLowerCase());
  const particles = new Set(['van', 'der', 'de', 'den', 'von', 'du', 'le', 'la']);
  let i = parts.length - 1;
  while (i - 1 >= 0 && particles.has(low[i - 1])) i--;
  return slug(parts.slice(i).join('-')) || 'unknown';
};

const publisherSlug = ({ source_name, source_domain }) => {
  if (source_name) return slug(source_name);
  if (source_domain) return slug(source_domain.replace(/^www\./i, '').split('.')[0]);
  return 'unknown';
};

export function kbFileName({
  title,
  date_published,
  authors = [],
  source_name = '',
  source_domain = '',
  version = '',
}) {
  const year = String(date_published || '0000').slice(0, 4) || '0000';
  const s = slug(title || 'untitled');
  const a = authors.length ? lastName(authors[0]) : 'unknown';
  const pub = publisherSlug({ source_name, source_domain });
  const ver = version ? `_v${String(version).replace(/^v/i, '')}` : '';
  return `${year}_${s}_${a}-${pub}${ver}.json`;
}
