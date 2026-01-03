import { type IndexedItem } from './filter-utils';

// Helper: Get all DOM elements
export function getDOMElements() {
  return {
    list: document.getElementById('list'),
    empty: document.getElementById('empty'),
    countEl: document.getElementById('count'),
    qEl: document.getElementById('q') as HTMLInputElement | null,
    filterChipsEl: document.getElementById('filter-chips'),
    searchSpinner: document.getElementById('search-spinner'),
    loadMoreBtn: document.getElementById('load-more-btn') as HTMLButtonElement | null,
    paginationCount: document.getElementById('pagination-count'),
    paginationContainer: document.getElementById('pagination-container'),
    loadingSkeleton: document.getElementById('loading-skeleton'),
    filterPanel: document.getElementById('filter-panel'),
    panelBackdrop: document.getElementById('panel-backdrop'),
    closeFilterPanelBtn: document.getElementById('close-panel'),
    openPanelBtn: document.getElementById('open-filter-panel'),
    clearAllBtn: document.getElementById('clear-all-filters'),
    applyFiltersBtn: document.getElementById('apply-filters'),
    panelCountNumber: document.getElementById('panel-count-number'),
    fabFilterCount: document.getElementById('fab-filter-count'),
    fabIcon: document.getElementById('fab-icon'),
    fabSpinner: document.getElementById('fab-spinner'),
    sortSelect: document.getElementById('sort-select') as HTMLSelectElement | null,
    emptyClearFilters: document.getElementById('empty-clear-filters'),
    emptyClearSearch: document.getElementById('empty-clear-search'),
  };
}

// Helper: Index data from list items
export function indexListData(list: HTMLElement): IndexedItem[] {
  return Array.from(list.children).map((node) => {
    const el = node as HTMLElement;
    const heading = el.querySelector('h3')?.textContent?.trim() || '';
    const linkTitle = el.querySelector('a')?.textContent?.trim() || '';
    return {
      el,
      title: heading || linkTitle,
      source_name: el.querySelector<HTMLElement>('.mt-1')?.textContent || '',
      authors: el.dataset.authors || '',
      summary: el.dataset.summaryMedium || '',
      role: el.dataset.role || '',
      industry: el.dataset.industry || '',
      topic: el.dataset.topic || '',
      content_type: el.dataset.content_type || '',
      geography: el.dataset.geography || '',
      regulator: el.dataset.regulator || '',
      regulation: el.dataset.regulation || '',
      obligation: el.dataset.obligation || '',
      process: el.dataset.process || '',
      date_published: el.dataset.date_published || '',
      date_added: el.dataset.date_added || '',
    };
  });
}
