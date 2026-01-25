import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSearchHistory,
  addToSearchHistory,
  renderSearchHistory,
  syncSearchInputs,
  createDebouncer,
} from '../../../../features/publications/filters/search';

describe('filters/search', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getSearchHistory', () => {
    it('returns empty array when no history', () => {
      expect(getSearchHistory()).toEqual([]);
    });

    it('returns stored history', () => {
      localStorage.setItem('publicationSearchHistory', JSON.stringify(['query1', 'query2']));
      expect(getSearchHistory()).toEqual(['query1', 'query2']);
    });

    it('returns empty array on parse error', () => {
      localStorage.setItem('publicationSearchHistory', 'invalid json');
      expect(getSearchHistory()).toEqual([]);
    });
  });

  describe('addToSearchHistory', () => {
    it('adds query to history', () => {
      addToSearchHistory('test query');
      expect(getSearchHistory()).toEqual(['test query']);
    });

    it('does not add empty or short queries', () => {
      addToSearchHistory('');
      addToSearchHistory('a');
      expect(getSearchHistory()).toEqual([]);
    });

    it('removes duplicates and adds to front', () => {
      addToSearchHistory('first');
      addToSearchHistory('second');
      addToSearchHistory('first');
      expect(getSearchHistory()).toEqual(['first', 'second']);
    });

    it('limits history to 5 items', () => {
      for (let i = 1; i <= 7; i++) {
        addToSearchHistory(`query${i}`);
      }
      const history = getSearchHistory();
      expect(history.length).toBe(5);
      expect(history[0]).toBe('query7');
    });
  });

  describe('renderSearchHistory', () => {
    it('does nothing when container is null', () => {
      renderSearchHistory(null, vi.fn());
      expect(true).toBe(true);
    });

    it('renders empty state when no history', () => {
      const container = document.createElement('div');
      renderSearchHistory(container, vi.fn());
      expect(container.innerHTML).toContain('No recent searches');
    });

    it('renders history items with click handlers', () => {
      localStorage.setItem('publicationSearchHistory', JSON.stringify(['query1', 'query2']));
      const container = document.createElement('div');
      const onSelect = vi.fn();

      renderSearchHistory(container, onSelect);

      expect(container.innerHTML).toContain('query1');
      expect(container.innerHTML).toContain('query2');

      const btn = container.querySelector('.search-history-item') as HTMLElement;
      btn.click();

      expect(onSelect).toHaveBeenCalledWith('query1');
    });
  });

  describe('syncSearchInputs', () => {
    it('syncs value to other inputs', () => {
      const source = document.createElement('input');
      const qEl = document.createElement('input');
      const mobileEl = document.createElement('input');

      source.value = 'test';
      syncSearchInputs('test', source, qEl, mobileEl);

      expect(qEl.value).toBe('test');
      expect(mobileEl.value).toBe('test');
    });

    it('does not sync to source element', () => {
      const source = document.createElement('input');
      source.value = 'original';

      syncSearchInputs('new', source, source, null);

      expect(source.value).toBe('original');
    });

    it('handles null elements', () => {
      const source = document.createElement('input');
      syncSearchInputs('test', source, null, null);
      expect(true).toBe(true);
    });
  });

  describe('createDebouncer', () => {
    it('debounces function calls', () => {
      const debounce = createDebouncer();
      const fn = vi.fn();

      debounce(fn);
      debounce(fn);
      debounce(fn);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('calls showSpinner and hideSpinner', () => {
      const debounce = createDebouncer();
      const fn = vi.fn();
      const showSpinner = vi.fn();
      const hideSpinner = vi.fn();

      debounce(fn, true, showSpinner, hideSpinner);

      expect(showSpinner).toHaveBeenCalled();
      expect(hideSpinner).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);

      expect(hideSpinner).toHaveBeenCalled();
    });
  });
});
