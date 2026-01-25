import { describe, expect, it, beforeEach, vi } from 'vitest';

import { setupMobileSheet } from '../../../../features/publications/filters/mobile-sheet';

vi.mock('../../../../features/publications/filters/storage', () => {
  return {
    getVals: () => ({
      q: '',
      role: 'all',
      industry: '',
      topic: '',
      content_type: '',
      geography: '',
    }),
    setVals: vi.fn(),
    saveToStorage: vi.fn(),
  };
});

vi.mock('../../../../features/publications/filters/ui', () => {
  return {
    renderChipsSummary: vi.fn(),
  };
});

vi.mock('../../../../features/publications/filters/search', () => {
  return {
    createDebouncer: () => (fn: () => void) => fn(),
  };
});

describe('setupMobileSheet', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="open-sheet"></button>
      <div id="filter-sheet" class="hidden" aria-hidden="true"></div>
      <div id="sheet-backdrop"></div>
      <button id="close-sheet"></button>
      <div id="m-result-number"></div>

      <input id="q" />
      <select id="f-role"></select>
      <select id="f-industry"></select>
      <select id="f-topic"></select>
      <select id="f-content_type"></select>
      <select id="f-geography"></select>

      <input id="m-q" />
      <select id="m-f-role"></select>
      <select id="m-f-industry"></select>
      <select id="m-f-topic"></select>
      <select id="m-f-content_type"></select>
      <select id="m-f-geography"></select>

      <button id="m-clear"></button>
      <button id="m-done"></button>
    `;
  });

  it('opens and closes the sheet via buttons', () => {
    const list = document.createElement('div');
    list.appendChild(document.createElement('div'));

    setupMobileSheet({
      list,
      qEl: document.getElementById('q') as HTMLInputElement,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply: () => 1,
      setCurrentPage: vi.fn(),
    });

    const openBtn = document.getElementById('open-sheet')!;
    const sheet = document.getElementById('filter-sheet')!;
    const closeBtn = document.getElementById('close-sheet')!;

    openBtn.dispatchEvent(new MouseEvent('click'));
    expect(sheet.classList.contains('hidden')).toBe(false);
    expect(sheet.getAttribute('aria-hidden')).toBe('false');

    closeBtn.dispatchEvent(new MouseEvent('click'));
    expect(sheet.classList.contains('hidden')).toBe(true);
    expect(sheet.getAttribute('aria-hidden')).toBe('true');
  });

  it('closes sheet via backdrop click', () => {
    const list = document.createElement('div');
    setupMobileSheet({
      list,
      qEl: null,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply: () => 1,
      setCurrentPage: vi.fn(),
    });

    const openBtn = document.getElementById('open-sheet')!;
    const sheet = document.getElementById('filter-sheet')!;
    const backdrop = document.getElementById('sheet-backdrop')!;

    openBtn.click();
    expect(sheet.classList.contains('hidden')).toBe(false);

    backdrop.click();
    expect(sheet.classList.contains('hidden')).toBe(true);
  });

  it('closes sheet via Escape key', () => {
    const list = document.createElement('div');
    setupMobileSheet({
      list,
      qEl: null,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply: () => 1,
      setCurrentPage: vi.fn(),
    });

    const openBtn = document.getElementById('open-sheet')!;
    const sheet = document.getElementById('filter-sheet')!;

    openBtn.click();
    expect(sheet.classList.contains('hidden')).toBe(false);

    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(sheet.classList.contains('hidden')).toBe(true);
  });

  it('applies filters from mobile select changes', () => {
    const list = document.createElement('div');
    const apply = vi.fn(() => 5);
    const setCurrentPage = vi.fn();

    setupMobileSheet({
      list,
      qEl: document.getElementById('q') as HTMLInputElement,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply,
      setCurrentPage,
    });

    const mobileRole = document.getElementById('m-f-role') as HTMLSelectElement;
    mobileRole.dispatchEvent(new Event('change'));

    expect(setCurrentPage).toHaveBeenCalledWith(1);
    expect(apply).toHaveBeenCalled();
  });

  it('applies filters from mobile search input with debounce', () => {
    const list = document.createElement('div');
    const apply = vi.fn(() => 3);
    const setCurrentPage = vi.fn();

    setupMobileSheet({
      list,
      qEl: document.getElementById('q') as HTMLInputElement,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply,
      setCurrentPage,
    });

    const mobileSearch = document.getElementById('m-q') as HTMLInputElement;
    mobileSearch.value = 'test search';
    mobileSearch.dispatchEvent(new Event('input'));

    expect(apply).toHaveBeenCalled();
  });

  it('clears mobile filters via clear button', () => {
    const list = document.createElement('div');
    const apply = vi.fn(() => 10);

    setupMobileSheet({
      list,
      qEl: null,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply,
      setCurrentPage: vi.fn(),
    });

    const mobileRole = document.getElementById('m-f-role') as HTMLSelectElement;
    mobileRole.value = 'analyst';

    const clearBtn = document.getElementById('m-clear')!;
    clearBtn.click();

    expect(mobileRole.value).toBe('');
    expect(apply).toHaveBeenCalled();
  });

  it('closes sheet via done button', () => {
    const list = document.createElement('div');

    setupMobileSheet({
      list,
      qEl: null,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply: () => 1,
      setCurrentPage: vi.fn(),
    });

    const openBtn = document.getElementById('open-sheet')!;
    const sheet = document.getElementById('filter-sheet')!;
    const doneBtn = document.getElementById('m-done')!;

    openBtn.click();
    expect(sheet.classList.contains('hidden')).toBe(false);

    doneBtn.click();
    expect(sheet.classList.contains('hidden')).toBe(true);
  });

  it('updates result count when opening sheet', () => {
    const list = document.createElement('div');
    const visibleItem = document.createElement('div');
    const hiddenItem = document.createElement('div');
    hiddenItem.classList.add('hidden');
    list.appendChild(visibleItem);
    list.appendChild(hiddenItem);

    setupMobileSheet({
      list,
      qEl: null,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply: () => 1,
      setCurrentPage: vi.fn(),
    });

    const openBtn = document.getElementById('open-sheet')!;
    const resultNumber = document.getElementById('m-result-number')!;

    openBtn.click();

    expect(resultNumber.textContent).toBe('1');
  });

  it('returns early if sheet elements not found', () => {
    document.body.innerHTML = '';
    const list = document.createElement('div');

    // Should not throw and return undefined (early exit)
    const result = setupMobileSheet({
      list,
      qEl: null,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply: () => 1,
      setCurrentPage: vi.fn(),
    });

    expect(result).toBeUndefined();
  });

  it('syncs values to mobile elements on open', () => {
    const list = document.createElement('div');
    // Add 'all' option to the select so value can be set
    const mobileRole = document.getElementById('m-f-role') as HTMLSelectElement;
    mobileRole.innerHTML = '<option value="">Select</option><option value="all">All</option>';

    setupMobileSheet({
      list,
      qEl: document.getElementById('q') as HTMLInputElement,
      mobileSearchEl: null,
      chipsEl: null,
      badgeEl: null,
      filters: [],
      apply: () => 1,
      setCurrentPage: vi.fn(),
    });

    const openBtn = document.getElementById('open-sheet')!;
    openBtn.click();

    // Verify mobile elements are synced (values come from mocked getVals)
    expect(mobileRole.value).toBe('all');
  });
});
