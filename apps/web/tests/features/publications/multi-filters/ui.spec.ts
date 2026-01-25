import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updatePaginationUI,
  showLoadingState,
  hideLoadingState,
  revealList,
  openPanel,
  closePanel,
  updateDateDisplay,
  createDebouncer,
} from '../../../../features/publications/multi-filters/ui';

describe('multi-filters/ui', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  describe('showLoadingState', () => {
    it('shows spinners and dims list', () => {
      const searchSpinner = document.createElement('div');
      searchSpinner.classList.add('hidden');
      const fabIcon = document.createElement('div');
      const fabSpinner = document.createElement('div');
      fabSpinner.classList.add('hidden');
      const list = document.createElement('div');

      showLoadingState(searchSpinner, fabIcon, fabSpinner, list);

      expect(searchSpinner.classList.contains('hidden')).toBe(false);
      expect(fabIcon.classList.contains('hidden')).toBe(true);
      expect(fabSpinner.classList.contains('hidden')).toBe(false);
      expect(list.style.opacity).toBe('0.5');
    });

    it('handles null elements', () => {
      showLoadingState(null, null, null, null);
      expect(true).toBe(true);
    });
  });

  describe('hideLoadingState', () => {
    it('hides spinners and restores list opacity', () => {
      const searchSpinner = document.createElement('div');
      const fabIcon = document.createElement('div');
      fabIcon.classList.add('hidden');
      const fabSpinner = document.createElement('div');
      const list = document.createElement('div');
      list.style.opacity = '0.5';

      hideLoadingState(searchSpinner, fabIcon, fabSpinner, list);

      expect(searchSpinner.classList.contains('hidden')).toBe(true);
      expect(fabIcon.classList.contains('hidden')).toBe(false);
      expect(fabSpinner.classList.contains('hidden')).toBe(true);
      expect(list.style.opacity).toBe('1');
    });
  });

  describe('revealList', () => {
    it('hides skeleton and reveals list', () => {
      const skeleton = document.createElement('div');
      const list = document.createElement('div');
      list.classList.add('opacity-0');

      revealList(skeleton, list);

      expect(skeleton.classList.contains('hidden')).toBe(true);
      expect(list.classList.contains('opacity-0')).toBe(false);
      expect(list.style.opacity).toBe('1');
    });

    it('handles null elements', () => {
      revealList(null, null);
      expect(true).toBe(true);
    });
  });

  describe('openPanel', () => {
    it('opens panel and sets count', () => {
      const panel = document.createElement('div');
      panel.classList.add('hidden');
      const countEl = document.createElement('span');

      openPanel(panel, countEl, 5);

      expect(panel.classList.contains('hidden')).toBe(false);
      expect(document.body.style.overflow).toBe('hidden');
      expect(countEl.textContent).toBe('5');
    });

    it('does nothing when panel is null', () => {
      openPanel(null, null, 0);
      expect(true).toBe(true);
    });
  });

  describe('closePanel', () => {
    it('closes panel and restores overflow', () => {
      const panel = document.createElement('div');
      document.body.style.overflow = 'hidden';

      closePanel(panel);

      expect(panel.classList.contains('hidden')).toBe(true);
      expect(document.body.style.overflow).toBe('');
    });

    it('does nothing when panel is null', () => {
      closePanel(null);
      expect(true).toBe(true);
    });
  });

  describe('updateDateDisplay', () => {
    it('updates labels for added sort', () => {
      document.body.innerHTML = `
        <div class="date-display" data-added="2024-01-01" data-published="2023-12-01">
          <span class="date-label"></span>
          <span class="date-value"></span>
        </div>
      `;

      updateDateDisplay('date_added_desc');

      const label = document.querySelector('.date-label');
      const value = document.querySelector('.date-value');
      expect(label?.textContent).toBe('Added');
      expect(value?.textContent).toBe('2024-01-01');
    });

    it('updates labels for published sort', () => {
      document.body.innerHTML = `
        <div class="date-display" data-added="2024-01-01" data-published="2023-12-01">
          <span class="date-label"></span>
          <span class="date-value"></span>
        </div>
      `;

      updateDateDisplay('published_desc');

      const label = document.querySelector('.date-label');
      const value = document.querySelector('.date-value');
      expect(label?.textContent).toBe('Published');
      expect(value?.textContent).toBe('2023-12-01');
    });
  });

  describe('createDebouncer', () => {
    it('debounces function calls', () => {
      const showLoading = vi.fn();
      const hideLoading = vi.fn();
      const fn = vi.fn();

      const debounce = createDebouncer(showLoading, hideLoading);

      debounce(fn);
      debounce(fn);
      debounce(fn);

      expect(showLoading).toHaveBeenCalledTimes(3);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(hideLoading).toHaveBeenCalledTimes(1);
    });
  });
});
