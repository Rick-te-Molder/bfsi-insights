import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateFilterChips } from '../../../../features/publications/multi-filters/chips';

describe('chips', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('updateFilterChips', () => {
    it('does nothing when filterChipsEl is null', () => {
      const renderAllChipsFn = vi.fn();
      const renderCollapsibleSummaryFn = vi.fn();

      updateFilterChips({
        state: {},
        query: '',
        filterChipsEl: null,
        filtersExpanded: false,
        renderAllChipsFn,
        renderCollapsibleSummaryFn,
      });

      expect(renderAllChipsFn).not.toHaveBeenCalled();
      expect(renderCollapsibleSummaryFn).not.toHaveBeenCalled();
    });

    it('calls renderAllChipsFn when not collapsing', () => {
      const filterChipsEl = document.createElement('div');
      const renderAllChipsFn = vi.fn();
      const renderCollapsibleSummaryFn = vi.fn();

      updateFilterChips({
        state: { industry: new Set(['banking']) },
        query: '',
        filterChipsEl,
        filtersExpanded: false,
        renderAllChipsFn,
        renderCollapsibleSummaryFn,
      });

      expect(renderAllChipsFn).toHaveBeenCalled();
      expect(renderCollapsibleSummaryFn).not.toHaveBeenCalled();
    });

    it('calls renderCollapsibleSummaryFn when collapsing', () => {
      const filterChipsEl = document.createElement('div');
      const renderAllChipsFn = vi.fn();
      const renderCollapsibleSummaryFn = vi.fn();

      updateFilterChips({
        state: {
          industry: new Set(['a', 'b']),
          topic: new Set(['c', 'd']),
        },
        query: '',
        filterChipsEl,
        filtersExpanded: false,
        renderAllChipsFn,
        renderCollapsibleSummaryFn,
      });

      expect(renderAllChipsFn).not.toHaveBeenCalled();
      expect(renderCollapsibleSummaryFn).toHaveBeenCalledWith({ industry: 2, topic: 2 }, 4, false);
    });

    it('clears filterChipsEl innerHTML', () => {
      const filterChipsEl = document.createElement('div');
      filterChipsEl.innerHTML = '<div>old content</div>';

      updateFilterChips({
        state: {},
        query: '',
        filterChipsEl,
        filtersExpanded: false,
        renderAllChipsFn: () => undefined,
        renderCollapsibleSummaryFn: () => undefined,
      });

      expect(filterChipsEl.innerHTML).toBe('');
    });

    it('supports positional arguments', () => {
      const filterChipsEl = document.createElement('div');
      const renderAllChipsFn = vi.fn();
      const renderCollapsibleSummaryFn = vi.fn();

      updateFilterChips(
        { industry: new Set(['a']) },
        '',
        filterChipsEl,
        false,
        renderAllChipsFn,
        renderCollapsibleSummaryFn,
      );

      expect(renderAllChipsFn).toHaveBeenCalled();
    });
  });
});
