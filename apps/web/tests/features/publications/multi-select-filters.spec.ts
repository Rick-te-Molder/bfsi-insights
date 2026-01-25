import { describe, it, expect } from 'vitest';
import initMultiSelectFilters from '../../../features/publications/multi-select-filters';

describe('multi-select-filters', () => {
  it('exports default function', () => {
    expect(typeof initMultiSelectFilters).toBe('function');
  });
});
