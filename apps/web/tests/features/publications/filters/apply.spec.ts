import { describe, it, expect, beforeEach } from 'vitest';
import { applyFilters, indexData } from '../../../../features/publications/filters/apply';

describe('filters/apply', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function createListItem(data: Record<string, string>) {
    const li = document.createElement('li');
    Object.entries(data).forEach(([key, value]) => {
      li.dataset[key] = value;
    });
    li.innerHTML = `
      <h3>${data.title || 'Title'}</h3>
      <div class="mt-1">${data.source || 'Source'}</div>
      <p class="text-sm">${data.summary || 'Summary'}</p>
    `;
    return li;
  }

  describe('indexData', () => {
    it('indexes list items with data attributes', () => {
      const list = document.createElement('ul');
      list.appendChild(createListItem({ title: 'Article 1', industry: 'banking' }));
      list.appendChild(createListItem({ title: 'Article 2', industry: 'insurance' }));

      const filters = [{ key: 'industry', el: document.createElement('select') }];
      const data = indexData(list, filters);

      expect(data.length).toBe(2);
      expect(data[0].title).toBe('Article 1');
      expect(data[0].industry).toBe('banking');
      expect(data[1].industry).toBe('insurance');
    });

    it('extracts title from h3 or link', () => {
      const list = document.createElement('ul');
      const li = document.createElement('li');
      li.innerHTML = '<a>Link Title</a>';
      list.appendChild(li);

      const data = indexData(list, []);
      expect(data[0].title).toBe('Link Title');
    });
  });

  describe('applyFilters', () => {
    it('shows all items when no filters applied', () => {
      const list = document.createElement('ul');
      list.appendChild(createListItem({ industry: 'banking' }));
      list.appendChild(createListItem({ industry: 'insurance' }));

      const filters = [{ key: 'industry', el: document.createElement('select') }];
      const data = indexData(list, filters);

      const result = applyFilters(data, filters, { q: '' }, 1, null);

      expect(result.visible).toBe(2);
      expect(result.total).toBe(2);
    });

    it('filters by select value', () => {
      const list = document.createElement('ul');
      list.appendChild(createListItem({ industry: 'banking' }));
      list.appendChild(createListItem({ industry: 'insurance' }));

      const filters = [{ key: 'industry', el: document.createElement('select') }];
      const data = indexData(list, filters);

      const result = applyFilters(data, filters, { q: '', industry: 'banking' }, 1, null);

      expect(result.visible).toBe(1);
      expect(result.total).toBe(1);
      expect(data[0].el.classList.contains('hidden')).toBe(false);
      expect(data[1].el.classList.contains('hidden')).toBe(true);
    });

    it('applies simple search when no Fuse', () => {
      const list = document.createElement('ul');
      list.appendChild(createListItem({ title: 'Banking Article' }));
      list.appendChild(createListItem({ title: 'Insurance Article' }));

      const data = indexData(list, []);

      const result = applyFilters(data, [], { q: 'banking' }, 1, null);

      expect(result.visible).toBe(1);
      expect(result.total).toBe(1);
    });

    it('paginates results', () => {
      const list = document.createElement('ul');
      for (let i = 0; i < 50; i++) {
        list.appendChild(createListItem({ title: `Article ${i}` }));
      }

      const data = indexData(list, []);

      const result = applyFilters(data, [], { q: '' }, 1, null);

      expect(result.visible).toBe(30);
      expect(result.total).toBe(50);
    });

    it('applies Fuse search when provided', () => {
      const list = document.createElement('ul');
      list.appendChild(createListItem({ title: 'Banking Article' }));
      list.appendChild(createListItem({ title: 'Insurance Article' }));

      const data = indexData(list, []);

      // Mock Fuse constructor
      const MockFuse = class {
        constructor(public data: any[]) {}
        search(query: string) {
          return this.data
            .map((d, i) => ({ item: d, refIndex: i }))
            .filter((r) => r.item.title.toLowerCase().includes(query.toLowerCase()));
        }
      };

      const result = applyFilters(data, [], { q: 'banking' }, 1, MockFuse);

      expect(result.visible).toBe(1);
      expect(result.total).toBe(1);
    });
  });
});
