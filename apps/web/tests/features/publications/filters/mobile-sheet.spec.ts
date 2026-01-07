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
});
