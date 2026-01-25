import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../../features/publications/filters/storage', () => ({
  saveAdvancedFiltersState: vi.fn(),
  getAdvancedFiltersState: vi.fn(() => false),
}));

import { setupAdvancedFiltersToggle } from '../../../../features/publications/filters/advanced-toggle';
import {
  saveAdvancedFiltersState,
  getAdvancedFiltersState,
} from '../../../../features/publications/filters/storage';

describe('advanced-toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  function createToggleDOM(initialExpanded = false) {
    document.body.innerHTML = `
      <button id="toggle-advanced-filters" aria-expanded="${initialExpanded}">
        <span>More filters</span>
      </button>
      <div id="advanced-filters" class="${initialExpanded ? '' : 'hidden'}"></div>
      <div id="advanced-filters-icon" class="${initialExpanded ? 'rotate-90' : ''}"></div>
    `;
  }

  it('does nothing when elements are missing', () => {
    setupAdvancedFiltersToggle();
    expect(true).toBe(true);
  });

  it('restores saved expanded state on init', () => {
    vi.mocked(getAdvancedFiltersState).mockReturnValue(true);
    createToggleDOM(false);

    setupAdvancedFiltersToggle();

    const filters = document.getElementById('advanced-filters');
    const icon = document.getElementById('advanced-filters-icon');
    const btn = document.getElementById('toggle-advanced-filters');

    expect(filters?.classList.contains('hidden')).toBe(false);
    expect(icon?.classList.contains('rotate-90')).toBe(true);
    expect(btn?.getAttribute('aria-expanded')).toBe('true');
  });

  it('toggles state on button click', () => {
    vi.mocked(getAdvancedFiltersState).mockReturnValue(false);
    createToggleDOM(false);

    setupAdvancedFiltersToggle();

    const btn = document.getElementById('toggle-advanced-filters') as HTMLElement;
    const filters = document.getElementById('advanced-filters');
    const icon = document.getElementById('advanced-filters-icon');

    btn.click();

    expect(filters?.classList.contains('hidden')).toBe(false);
    expect(icon?.classList.contains('rotate-90')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(saveAdvancedFiltersState).toHaveBeenCalledWith(true);

    btn.click();

    expect(filters?.classList.contains('hidden')).toBe(true);
    expect(icon?.classList.contains('rotate-90')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(saveAdvancedFiltersState).toHaveBeenCalledWith(false);
  });

  it('updates button text on toggle', () => {
    vi.mocked(getAdvancedFiltersState).mockReturnValue(false);
    createToggleDOM(false);

    setupAdvancedFiltersToggle();

    const btn = document.getElementById('toggle-advanced-filters') as HTMLElement;
    const span = btn.querySelector('span');

    expect(span?.textContent).toBe('More filters');

    btn.click();
    expect(span?.textContent).toBe('Fewer filters');

    btn.click();
    expect(span?.textContent).toBe('More filters');
  });
});
