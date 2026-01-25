import { describe, it, expect, vi } from 'vitest';
import {
  createChip,
  createCategoryChipGroup,
} from '../../../../features/publications/multi-filters/chips-chip';

describe('chips-chip', () => {
  describe('createChip', () => {
    it('creates a button element with label', () => {
      const chip = createChip('Test Label', vi.fn());
      expect(chip.tagName).toBe('BUTTON');
      expect(chip.innerHTML).toContain('Test Label');
    });

    it('calls onRemove when clicked', () => {
      const onRemove = vi.fn();
      const chip = createChip('Test', onRemove);

      chip.click();

      expect(onRemove).toHaveBeenCalled();
    });

    it('has correct styling classes', () => {
      const chip = createChip('Test', vi.fn());
      expect(chip.className).toContain('inline-flex');
      expect(chip.className).toContain('rounded-full');
    });
  });

  describe('createCategoryChipGroup', () => {
    it('creates group with label and chips', () => {
      const config = {
        key: 'industry',
        values: new Set(['banking', 'insurance']),
        filterState: { industry: new Set(['banking', 'insurance']) },
        searchQuery: '',
        applyFilterStateToCheckboxes: vi.fn(),
        applyFilters: vi.fn(),
        saveFilters: vi.fn(),
      };

      const group = createCategoryChipGroup(config);

      expect(group.innerHTML).toContain('industry:');
      expect(group.innerHTML).toContain('banking');
      expect(group.innerHTML).toContain('insurance');
    });

    it('removes value from filterState when chip clicked', () => {
      const filterState = { industry: new Set(['banking', 'insurance']) };
      const applyFilterStateToCheckboxes = vi.fn();
      const applyFilters = vi.fn();
      const saveFilters = vi.fn();

      const config = {
        key: 'industry',
        values: new Set(['banking']),
        filterState,
        searchQuery: 'query',
        applyFilterStateToCheckboxes,
        applyFilters,
        saveFilters,
      };

      const group = createCategoryChipGroup(config);
      const chip = group.querySelector('button') as HTMLElement;

      chip.click();

      expect(filterState.industry.has('banking')).toBe(false);
      expect(applyFilterStateToCheckboxes).toHaveBeenCalledWith(filterState);
      expect(applyFilters).toHaveBeenCalledWith(filterState, 'query', true);
      expect(saveFilters).toHaveBeenCalled();
    });
  });
});
