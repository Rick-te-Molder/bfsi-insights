import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderChipsSummary,
  updatePaginationUI,
  showSearchSuggestions,
  hideSearchSuggestions,
  showSpinner,
  hideSpinner,
} from '../../../../features/publications/filters/ui';

describe('filters/ui', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('renderChipsSummary', () => {
    it('does nothing when chipsEl is null', () => {
      renderChipsSummary({ q: '' }, null, null, vi.fn());
      expect(true).toBe(true);
    });

    it('renders chips for active filters', () => {
      const chipsEl = document.createElement('div');
      const badgeEl = document.createElement('span');
      const onRemove = vi.fn();

      renderChipsSummary(
        { q: 'search', industry: 'banking', topic: 'ai' },
        chipsEl,
        badgeEl,
        onRemove,
      );

      expect(chipsEl.querySelectorAll('button').length).toBe(2);
      expect(chipsEl.innerHTML).toContain('industry');
      expect(chipsEl.innerHTML).toContain('Banking');
      expect(badgeEl.textContent).toBe('3'); // 2 filters + 1 search
    });

    it('calls onRemove when chip clicked', () => {
      const chipsEl = document.createElement('div');
      const onRemove = vi.fn();

      renderChipsSummary({ q: '', industry: 'banking' }, chipsEl, null, onRemove);

      const btn = chipsEl.querySelector('button') as HTMLElement;
      btn.click();

      expect(onRemove).toHaveBeenCalledWith('industry');
    });

    it('excludes q and "all" values from chips', () => {
      const chipsEl = document.createElement('div');

      renderChipsSummary({ q: 'search', role: 'all', industry: '' }, chipsEl, null, vi.fn());

      expect(chipsEl.querySelectorAll('button').length).toBe(0);
    });
  });

  describe('updatePaginationUI', () => {
    it('does nothing when elements are null', () => {
      updatePaginationUI(10, 20, null, null, null);
      expect(true).toBe(true);
    });

    it('hides container when total is 0', () => {
      const loadMoreBtn = document.createElement('button') as HTMLButtonElement;
      const paginationCount = document.createElement('span');
      const paginationContainer = document.createElement('div');

      updatePaginationUI(0, 0, loadMoreBtn, paginationCount, paginationContainer);

      expect(paginationContainer.classList.contains('hidden')).toBe(true);
    });

    it('shows load more when visible < total', () => {
      const loadMoreBtn = document.createElement('button') as HTMLButtonElement;
      loadMoreBtn.classList.add('hidden');
      const paginationCount = document.createElement('span');
      const paginationContainer = document.createElement('div');

      updatePaginationUI(10, 20, loadMoreBtn, paginationCount, paginationContainer);

      expect(loadMoreBtn.classList.contains('hidden')).toBe(false);
      expect(paginationCount.textContent).toBe('Showing 10 of 20 publications');
    });

    it('hides load more when visible >= total', () => {
      const loadMoreBtn = document.createElement('button') as HTMLButtonElement;
      const paginationCount = document.createElement('span');
      const paginationContainer = document.createElement('div');

      updatePaginationUI(20, 20, loadMoreBtn, paginationCount, paginationContainer);

      expect(loadMoreBtn.classList.contains('hidden')).toBe(true);
    });
  });

  describe('showSearchSuggestions', () => {
    it('does nothing when suggestionsEl is null', () => {
      showSearchSuggestions(null, null, vi.fn(), vi.fn());
      expect(true).toBe(true);
    });

    it('renders history and shows suggestions', () => {
      const suggestionsEl = document.createElement('div');
      suggestionsEl.classList.add('hidden');
      const historyEl = document.createElement('div');
      const renderHistory = vi.fn();
      const onSelect = vi.fn();

      showSearchSuggestions(suggestionsEl, historyEl, renderHistory, onSelect);

      expect(renderHistory).toHaveBeenCalledWith(historyEl, onSelect);
      expect(suggestionsEl.classList.contains('hidden')).toBe(false);
    });
  });

  describe('hideSearchSuggestions', () => {
    it('does nothing when suggestionsEl is null', () => {
      hideSearchSuggestions(null);
      expect(true).toBe(true);
    });

    it('adds hidden class', () => {
      const suggestionsEl = document.createElement('div');
      hideSearchSuggestions(suggestionsEl);
      expect(suggestionsEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('showSpinner', () => {
    it('removes hidden class from spinners', () => {
      const spinner1 = document.createElement('div');
      spinner1.classList.add('hidden');
      const spinner2 = document.createElement('div');
      spinner2.classList.add('hidden');

      showSpinner(spinner1, spinner2);

      expect(spinner1.classList.contains('hidden')).toBe(false);
      expect(spinner2.classList.contains('hidden')).toBe(false);
    });

    it('handles null spinners', () => {
      showSpinner(null, null);
      expect(true).toBe(true);
    });
  });

  describe('hideSpinner', () => {
    it('adds hidden class to spinners', () => {
      const spinner1 = document.createElement('div');
      const spinner2 = document.createElement('div');

      hideSpinner(spinner1, spinner2);

      expect(spinner1.classList.contains('hidden')).toBe(true);
      expect(spinner2.classList.contains('hidden')).toBe(true);
    });
  });
});
