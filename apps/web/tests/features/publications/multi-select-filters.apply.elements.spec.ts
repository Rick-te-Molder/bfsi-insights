import { describe, it, expect } from 'vitest';
import { pickElements } from '../../../features/publications/multi-select-filters.apply.elements';

describe('multi-select-filters.apply.elements', () => {
  describe('pickElements', () => {
    it('returns null for missing elements', () => {
      const result = pickElements({});

      expect(result.list).toBeNull();
      expect(result.empty).toBeNull();
      expect(result.countEl).toBeNull();
      expect(result.qEl).toBeNull();
      expect(result.filterChipsEl).toBeNull();
      expect(result.loadMoreBtn).toBeNull();
      expect(result.paginationCount).toBeNull();
      expect(result.paginationContainer).toBeNull();
      expect(result.panelCountNumber).toBeNull();
      expect(result.fabFilterCount).toBeNull();
    });

    it('picks elements from input object', () => {
      const list = document.createElement('ul');
      const empty = document.createElement('div');
      const countEl = document.createElement('span');
      const qEl = document.createElement('input');
      const filterChipsEl = document.createElement('div');
      const loadMoreBtn = document.createElement('button');
      const paginationCount = document.createElement('span');
      const paginationContainer = document.createElement('div');
      const panelCountNumber = document.createElement('span');
      const fabFilterCount = document.createElement('span');

      const result = pickElements({
        list,
        empty,
        countEl,
        qEl,
        filterChipsEl,
        loadMoreBtn,
        paginationCount,
        paginationContainer,
        panelCountNumber,
        fabFilterCount,
      });

      expect(result.list).toBe(list);
      expect(result.empty).toBe(empty);
      expect(result.countEl).toBe(countEl);
      expect(result.qEl).toBe(qEl);
      expect(result.filterChipsEl).toBe(filterChipsEl);
      expect(result.loadMoreBtn).toBe(loadMoreBtn);
      expect(result.paginationCount).toBe(paginationCount);
      expect(result.paginationContainer).toBe(paginationContainer);
      expect(result.panelCountNumber).toBe(panelCountNumber);
      expect(result.fabFilterCount).toBe(fabFilterCount);
    });

    it('returns null for loadMoreBtn if not HTMLButtonElement', () => {
      const notAButton = document.createElement('div');

      const result = pickElements({ loadMoreBtn: notAButton });

      expect(result.loadMoreBtn).toBeNull();
    });

    it('handles undefined values with nullish coalescing', () => {
      const result = pickElements({
        list: undefined,
        empty: undefined,
      });

      expect(result.list).toBeNull();
      expect(result.empty).toBeNull();
    });
  });
});
