import type { FilterValues } from './types';

export function renderChipsSummary(
  vals: FilterValues,
  chipsEl: HTMLElement | null,
  badgeEl: HTMLElement | null,
  onRemove: (key: string) => void,
) {
  if (!chipsEl) return;

  chipsEl.innerHTML = '';

  const entries = Object.entries(vals).filter(
    ([key, value]) => key !== 'q' && value && value !== 'all',
  );

  entries.forEach(([key, value]) => {
    const button = document.createElement('button');
    button.className =
      'rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-800';
    const displayValue = value.charAt(0).toUpperCase() + value.slice(1);
    button.textContent = `${key.replace('_', ' ')}: ${displayValue} ✕`;
    button.addEventListener('click', () => onRemove(key));
    chipsEl.appendChild(button);
  });

  const activeCount = entries.length + (vals.q?.trim() ? 1 : 0);
  if (badgeEl) badgeEl.textContent = String(activeCount);
}

export function updatePaginationUI(
  visible: number,
  total: number,
  loadMoreBtn: HTMLButtonElement | null,
  paginationCount: HTMLElement | null,
  paginationContainer: HTMLElement | null,
) {
  if (!loadMoreBtn || !paginationCount || !paginationContainer) return;

  const hasMore = visible < total;

  if (total === 0) {
    paginationContainer.classList.add('hidden');
    return;
  }

  paginationContainer.classList.remove('hidden');
  paginationCount.textContent = `Showing ${visible} of ${total} publications`;

  if (hasMore) {
    loadMoreBtn.classList.remove('hidden');
    loadMoreBtn.disabled = false;
  } else {
    loadMoreBtn.classList.add('hidden');
  }
}

export function showSearchSuggestions(
  suggestionsEl: HTMLElement | null,
  historyEl: HTMLElement | null,
  renderHistory: (container: HTMLElement | null, onSelect: (q: string) => void) => void,
  onSelect: (q: string) => void,
) {
  if (!suggestionsEl) return;
  renderHistory(historyEl, onSelect);
  suggestionsEl.classList.remove('hidden');
}

export function hideSearchSuggestions(suggestionsEl: HTMLElement | null) {
  if (!suggestionsEl) return;
  suggestionsEl.classList.add('hidden');
}

export function showSpinner(
  searchSpinner: HTMLElement | null,
  mobileSearchSpinner: HTMLElement | null,
) {
  searchSpinner?.classList.remove('hidden');
  mobileSearchSpinner?.classList.remove('hidden');
}

export function hideSpinner(
  searchSpinner: HTMLElement | null,
  mobileSearchSpinner: HTMLElement | null,
) {
  searchSpinner?.classList.add('hidden');
  mobileSearchSpinner?.classList.add('hidden');
}
