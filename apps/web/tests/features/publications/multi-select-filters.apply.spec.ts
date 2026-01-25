import { describe, it, expect } from 'vitest';
import { createApplyFiltersFunction } from '../../../features/publications/multi-select-filters.apply';

describe('multi-select-filters.apply', () => {
  it('exports createApplyFiltersFunction', () => {
    expect(typeof createApplyFiltersFunction).toBe('function');
  });
});
