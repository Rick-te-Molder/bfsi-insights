import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderAllChips } from '../../../../features/publications/multi-filters/chips-render-all';

describe('chips-render-all', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does nothing when filterChipsEl is null', () => {
    renderAllChips({
      state: {},
      query: '',
      filterChipsEl: null,
      qEl: null,
      filterState: {},
      searchQuery: '',
      applyFilterStateToCheckboxes: vi.fn(),
      applyFilters: vi.fn(),
      saveFilters: vi.fn(),
    });
    expect(true).toBe(true);
  });

  it('renders search chip when query provided', () => {
    const filterChipsEl = document.createElement('div');
    const applyFilters = vi.fn();

    renderAllChips({
      state: {},
      query: 'test query',
      filterChipsEl,
      qEl: null,
      filterState: {},
      searchQuery: '',
      applyFilterStateToCheckboxes: vi.fn(),
      applyFilters,
      saveFilters: vi.fn(),
    });

    expect(filterChipsEl.innerHTML).toContain('search: test query');
  });

  it('clears search when search chip clicked', () => {
    const filterChipsEl = document.createElement('div');
    const qEl = document.createElement('input');
    qEl.value = 'test';
    const applyFilters = vi.fn();

    renderAllChips({
      state: {},
      query: 'test',
      filterChipsEl,
      qEl,
      filterState: {},
      searchQuery: '',
      applyFilterStateToCheckboxes: vi.fn(),
      applyFilters,
      saveFilters: vi.fn(),
    });

    const chip = filterChipsEl.querySelector('button') as HTMLElement;
    chip.click();

    expect(qEl.value).toBe('');
    expect(applyFilters).toHaveBeenCalledWith({}, '', true);
  });

  it('renders chips for each filter value', () => {
    const filterChipsEl = document.createElement('div');

    renderAllChips({
      state: {
        industry: new Set(['banking', 'insurance']),
        topic: new Set(['ai']),
      },
      query: '',
      filterChipsEl,
      qEl: null,
      filterState: {
        industry: new Set(['banking', 'insurance']),
        topic: new Set(['ai']),
      },
      searchQuery: '',
      applyFilterStateToCheckboxes: vi.fn(),
      applyFilters: vi.fn(),
      saveFilters: vi.fn(),
    });

    expect(filterChipsEl.querySelectorAll('button').length).toBe(3);
    expect(filterChipsEl.innerHTML).toContain('industry: banking');
    expect(filterChipsEl.innerHTML).toContain('industry: insurance');
    expect(filterChipsEl.innerHTML).toContain('topic: ai');
  });

  it('removes value from filterState when chip clicked', () => {
    const filterChipsEl = document.createElement('div');
    const filterState = {
      industry: new Set(['banking']),
    };
    const applyFilterStateToCheckboxes = vi.fn();
    const applyFilters = vi.fn();
    const saveFilters = vi.fn();

    renderAllChips({
      state: { industry: new Set(['banking']) },
      query: '',
      filterChipsEl,
      qEl: null,
      filterState,
      searchQuery: 'query',
      applyFilterStateToCheckboxes,
      applyFilters,
      saveFilters,
    });

    const chip = filterChipsEl.querySelector('button') as HTMLElement;
    chip.click();

    expect(filterState.industry.has('banking')).toBe(false);
    expect(applyFilterStateToCheckboxes).toHaveBeenCalledWith(filterState);
    expect(applyFilters).toHaveBeenCalledWith(filterState, 'query', true);
    expect(saveFilters).toHaveBeenCalled();
  });
});
