import type { FilterValues } from './types';

const SEARCH_HISTORY_KEY = 'publicationSearchHistory';
const MAX_SEARCH_HISTORY = 5;

export function getSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addToSearchHistory(query: string) {
  if (!query.trim() || query.length < 2) return;
  try {
    let history = getSearchHistory();
    history = history.filter((h) => h.toLowerCase() !== query.toLowerCase());
    history.unshift(query.trim());
    history = history.slice(0, MAX_SEARCH_HISTORY);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function renderSearchHistory(
  container: HTMLElement | null,
  onSelect: (query: string) => void,
) {
  if (!container) return;
  const history = getSearchHistory();
  if (history.length === 0) {
    container.innerHTML = `
      <div class="px-3 py-2 text-xs text-neutral-500">No recent searches</div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="px-3 py-1.5 text-xs text-neutral-500 border-b border-neutral-800">Recent searches</div>
    ${history
      .map(
        (q) => `
      <button
        type="button"
        class="w-full px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 search-history-item"
        data-query="${q.replace(/"/g, '&quot;')}"
      >
        <svg class="h-3.5 w-3.5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        ${q}
      </button>
    `,
      )
      .join('')}
  `;
  container.querySelectorAll('.search-history-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const query = (e.currentTarget as HTMLElement).dataset.query || '';
      onSelect(query);
    });
  });
}

export function syncSearchInputs(
  value: string,
  source: HTMLInputElement | null,
  qEl: HTMLInputElement | null,
  mobileSearchEl: HTMLInputElement | null,
) {
  if (qEl && qEl !== source) qEl.value = value;
  if (mobileSearchEl && mobileSearchEl !== source) mobileSearchEl.value = value;
}

export function createDebouncer() {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (
    fn: () => void,
    showLoading = true,
    showSpinner?: () => void,
    hideSpinner?: () => void,
  ) => {
    if (t) globalThis.clearTimeout(t);
    if (showLoading && showSpinner) showSpinner();
    t = globalThis.setTimeout(() => {
      fn();
      if (hideSpinner) hideSpinner();
    }, 250);
  };
}
