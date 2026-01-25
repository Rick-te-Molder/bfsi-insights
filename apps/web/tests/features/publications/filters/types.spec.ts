import { describe, it, expect } from 'vitest';
import type {
  FilterValues,
  IndexedItem,
  FilterElement,
} from '../../../../features/publications/filters/types';

describe('filters/types', () => {
  it('FilterValues type allows string record with q property', () => {
    const values: FilterValues = { q: 'search', industry: 'banking' };
    expect(values.q).toBe('search');
    expect(values.industry).toBe('banking');
  });

  it('IndexedItem type has required properties', () => {
    const item: IndexedItem = {
      el: document.createElement('div'),
      title: 'Test',
      source_name: 'Source',
      authors: 'Author',
      summary: 'Summary',
      tags_text: 'tag1, tag2',
    };
    expect(item.title).toBe('Test');
    expect(item.el).toBeInstanceOf(HTMLElement);
  });

  it('FilterElement type has key and el', () => {
    const select = document.createElement('select') as HTMLSelectElement;
    const element: FilterElement = { key: 'industry', el: select };
    expect(element.key).toBe('industry');
    expect(element.el).toBe(select);
  });
});
