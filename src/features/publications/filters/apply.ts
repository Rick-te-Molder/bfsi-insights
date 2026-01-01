import type { IndexedItem, FilterValues, FilterElement } from './types';

const PAGE_SIZE = 30;

export function applyFilters(
  data: IndexedItem[],
  filters: FilterElement[],
  vals: FilterValues,
  currentPage: number,
  FuseCtor: any,
): { visible: number; total: number } {
  let allowed = new Set<number>(data.map((_, i) => i));

  // Apply filter constraints
  for (const { key } of filters) {
    const value = vals[key];
    if (!value || value === 'all') continue;

    const next = new Set<number>();
    allowed.forEach((idx) => {
      const itemValue = data[idx][key];
      if (typeof itemValue === 'string') {
        if (itemValue === value || itemValue.split(',').includes(value)) {
          next.add(idx);
        }
      }
    });
    allowed = next;
  }

  // Apply search query
  if (vals.q) {
    if (FuseCtor) {
      const fuse = new FuseCtor(data, {
        includeScore: true,
        threshold: 0.2,
        keys: [
          { name: 'title', weight: 0.6 },
          { name: 'source_name', weight: 0.2 },
          { name: 'authors', weight: 0.1 },
          { name: 'summary', weight: 0.05 },
          { name: 'tags_text', weight: 0.05 },
        ],
      });

      const res = fuse.search(vals.q);
      const ids = new Set(res.map((r: any) => r.refIndex));
      allowed = new Set([...allowed].filter((i) => ids.has(i)));
    } else {
      const q = vals.q.toLowerCase();
      const match = (d: IndexedItem) =>
        d.title.toLowerCase().includes(q) ||
        d.source_name.toLowerCase().includes(q) ||
        d.authors.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.tags_text.toLowerCase().includes(q);

      allowed = new Set([...allowed].filter((i) => match(data[i])));
    }
  }

  const filteredIndices = Array.from(allowed);
  const totalFiltered = filteredIndices.length;
  const visibleCount = Math.min(currentPage * PAGE_SIZE, totalFiltered);
  const visibleIndices = new Set(filteredIndices.slice(0, visibleCount));

  let visible = 0;
  data.forEach((item, index) => {
    const isVisible = visibleIndices.has(index);
    item.el.classList.toggle('hidden', !isVisible);
    if (isVisible) visible++;
  });

  return { visible, total: totalFiltered };
}

export function indexData(list: HTMLElement, filters: FilterElement[]): IndexedItem[] {
  return Array.from(list.children).map((node) => {
    const el = node as HTMLElement;
    const heading = el.querySelector('h3')?.textContent?.trim() || '';
    const linkTitle = el.querySelector('a')?.textContent?.trim() || '';
    const item: IndexedItem = {
      el,
      title: heading || linkTitle,
      source_name: el.querySelector<HTMLElement>('.mt-1')?.textContent || '',
      authors: el.dataset.authors || '',
      summary: el.dataset.summaryMedium || el.querySelector('p.text-sm')?.textContent?.trim() || '',
      tags_text: [
        el.dataset.role || '',
        el.dataset.industry || '',
        el.dataset.topic || '',
        el.dataset.content_type || '',
        el.dataset.geography || '',
      ]
        .filter(Boolean)
        .join(' '),
    };

    filters.forEach(({ key }) => {
      item[key] = el.dataset[key] || '';
    });

    return item;
  });
}
