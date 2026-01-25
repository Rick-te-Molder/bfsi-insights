import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initIndustryCascade } from '../../../features/publications/industry-cascade';

vi.mock('../../../features/publications/hierarchy-cascade', () => ({
  initHierarchyCascade: vi.fn(),
}));

import { initHierarchyCascade } from '../../../features/publications/hierarchy-cascade';

describe('industry-cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls initHierarchyCascade with "industry"', () => {
    initIndustryCascade();
    expect(initHierarchyCascade).toHaveBeenCalledWith('industry');
  });
});
