import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeAndRenderResults,
  updateResultUI,
} from '../../../features/publications/multi-select-filters.apply.results';

function createIndexedItem(data: Partial<{ title: string; industry: string; topic: string }> = {}) {
  const el = document.createElement('li');
  return {
    el,
    title: data.title || 'Test',
    source_name: 'Source',
    authors: 'Author',
    summary: 'Summary',
    tags_text: '',
    date_published: '2024-01-01',
    date_added: '2024-01-02',
    industry: data.industry || '',
    topic: data.topic || '',
  };
}

describe('multi-select-filters.apply.results', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('computeAndRenderResults', () => {
    it('returns matching and visible counts', () => {
      const list = document.createElement('ul');
      const data = [
        createIndexedItem({ industry: 'banking' }),
        createIndexedItem({ industry: 'insurance' }),
        createIndexedItem({ industry: 'banking' }),
      ];

      const result = computeAndRenderResults({
        data,
        state: { industry: new Set(['banking']) },
        query: '',
        sortOrder: 'date_published_desc',
        currentPage: 1,
        pageSize: 30,
        list,
      });

      expect(result.totalMatching).toBe(2);
      expect(result.visible).toBe(2);
    });

    it('hides non-matching items', () => {
      const list = document.createElement('ul');
      const data = [
        createIndexedItem({ industry: 'banking' }),
        createIndexedItem({ industry: 'insurance' }),
      ];

      computeAndRenderResults({
        data,
        state: { industry: new Set(['banking']) },
        query: '',
        sortOrder: 'date_published_desc',
        currentPage: 1,
        pageSize: 30,
        list,
      });

      expect(data[0].el.classList.contains('hidden')).toBe(false);
      expect(data[1].el.classList.contains('hidden')).toBe(true);
    });

    it('paginates results', () => {
      const list = document.createElement('ul');
      const data = Array.from({ length: 50 }, () => createIndexedItem());

      const result = computeAndRenderResults({
        data,
        state: {},
        query: '',
        sortOrder: 'date_published_desc',
        currentPage: 1,
        pageSize: 30,
        list,
      });

      expect(result.totalMatching).toBe(50);
      expect(result.visible).toBe(30);
    });

    it('filters by search query', () => {
      const list = document.createElement('ul');
      const data = [
        createIndexedItem({ title: 'Banking Article' }),
        createIndexedItem({ title: 'Insurance Article' }),
      ];

      const result = computeAndRenderResults({
        data,
        state: {},
        query: 'banking',
        sortOrder: 'date_published_desc',
        currentPage: 1,
        pageSize: 30,
        list,
      });

      expect(result.totalMatching).toBe(1);
    });
  });

  describe('updateResultUI', () => {
    it('shows empty state when no matches', () => {
      const empty = document.createElement('div');
      empty.classList.add('hidden');

      updateResultUI({
        empty,
        countEl: null,
        panelCountNumber: null,
        totalMatching: 0,
        visible: 0,
      });

      expect(empty.classList.contains('hidden')).toBe(false);
    });

    it('hides empty state when matches exist', () => {
      const empty = document.createElement('div');

      updateResultUI({
        empty,
        countEl: null,
        panelCountNumber: null,
        totalMatching: 5,
        visible: 5,
      });

      expect(empty.classList.contains('hidden')).toBe(true);
    });

    it('updates count text', () => {
      const countEl = document.createElement('span');

      updateResultUI({
        empty: null,
        countEl,
        panelCountNumber: null,
        totalMatching: 100,
        visible: 30,
      });

      expect(countEl.textContent).toBe('Showing 30 of 100 publications');
    });

    it('updates panel count number', () => {
      const panelCountNumber = document.createElement('span');

      updateResultUI({
        empty: null,
        countEl: null,
        panelCountNumber,
        totalMatching: 42,
        visible: 30,
      });

      expect(panelCountNumber.textContent).toBe('42');
    });
  });
});
