import { describe, expect, it, beforeEach, vi } from 'vitest';

import type { FilterElement } from '../../../../features/publications/filters/types';
import {
  clearStorage,
  getAdvancedFiltersState,
  getVals,
  readFromQuery,
  saveAdvancedFiltersState,
  saveToStorage,
  setVals,
  updateQuery,
} from '../../../../features/publications/filters/storage';

vi.mock('../../../../lib/filters', () => {
  return {
    getDefaultRole: (personaPref: string | null) => personaPref ?? 'all',
  };
});

function setSelectOptions(selectEl: HTMLSelectElement, values: string[]) {
  selectEl.innerHTML = '';
  values.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function makeFilters(): {
  filters: FilterElement[];
  q: HTMLInputElement;
  mobileQ: HTMLInputElement;
} {
  const role = document.createElement('select');
  setSelectOptions(role, ['all', 'executive']);
  role.value = 'executive';
  const industry = document.createElement('select');
  setSelectOptions(industry, ['banking', 'insurance']);
  industry.value = 'banking';

  const q = document.createElement('input');
  q.value = ' hello ';
  const mobileQ = document.createElement('input');
  mobileQ.value = '';

  const filters: FilterElement[] = [
    { key: 'role', el: role },
    { key: 'industry', el: industry },
  ];

  return { filters, q, mobileQ };
}

describe('apps/web/features/publications/filters/storage', () => {
  beforeEach(() => {
    localStorage.clear();
    // @ts-expect-error - test override
    globalThis.location = { pathname: '/publications', search: '' };
    // @ts-expect-error - test override
    globalThis.history = { replaceState: vi.fn() };
  });

  it('getVals reads values from filter elements + q inputs', () => {
    const { filters, q, mobileQ } = makeFilters();
    const vals = getVals(filters, q, mobileQ);
    expect(vals.role).toBe('executive');
    expect(vals.industry).toBe('banking');
    expect(vals.q).toBe('hello');
  });

  it('setVals writes values to filter elements + q inputs', () => {
    const { filters, q, mobileQ } = makeFilters();

    setVals({ role: 'all', industry: 'insurance', q: 'x' }, filters, q, mobileQ);

    expect(filters[0].el.value).toBe('all');
    expect(filters[1].el.value).toBe('insurance');
    expect(q.value).toBe('x');
    expect(mobileQ.value).toBe('x');
  });

  it('updateQuery writes expected query string', () => {
    updateQuery(
      {
        role: 'all',
        industry: 'banking',
        topic: '',
        content_type: '',
        geography: '',
        q: 'ai',
      } as any,
      2,
    );

    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('/publications?'),
    );
    const url = (history.replaceState as any).mock.calls[0][2] as string;
    expect(url).toContain('industry=banking');
    expect(url).toContain('q=ai');
    expect(url).toContain('page=2');
  });

  it('readFromQuery parses query string and page', () => {
    // @ts-expect-error - test override
    globalThis.location = {
      pathname: '/publications',
      search: '?role=all&industry=banking&q=test&page=3',
    };

    const role = document.createElement('select');
    const industry = document.createElement('select');

    const { vals, page } = readFromQuery([
      { key: 'role', el: role },
      { key: 'industry', el: industry },
    ]);

    expect(page).toBe(3);
    expect(vals.role).toBe('all');
    expect(vals.industry).toBe('banking');
    expect(vals.q).toBe('test');
  });

  it('readFromQuery falls back to localStorage when query is empty', () => {
    localStorage.setItem('bfsi-persona-preference', 'executive');
    localStorage.setItem('publicationFiltersV1', JSON.stringify({ industry: 'banking', q: 'ai' }));

    const role = document.createElement('select');
    const industry = document.createElement('select');

    const { vals, page } = readFromQuery([
      { key: 'role', el: role },
      { key: 'industry', el: industry },
    ]);

    expect(page).toBe(1);
    expect(vals.role).toBe('executive');
    expect(vals.industry).toBe('banking');
    expect(vals.q).toBe('ai');
  });

  it('saveToStorage and clearStorage persist values', () => {
    saveToStorage({ role: 'all', q: 'x' } as any);
    expect(localStorage.getItem('publicationFiltersV1')).toContain('"q":"x"');

    clearStorage();
    expect(localStorage.getItem('publicationFiltersV1')).toBeNull();
  });

  it('saveAdvancedFiltersState/getAdvancedFiltersState roundtrip', () => {
    saveAdvancedFiltersState(true);
    expect(getAdvancedFiltersState()).toBe(true);

    saveAdvancedFiltersState(false);
    expect(getAdvancedFiltersState()).toBe(false);
  });
});
