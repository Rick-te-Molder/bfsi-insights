type Elements = {
  list: HTMLElement | null;
  empty: HTMLElement | null;
  countEl: HTMLElement | null;
  qEl: HTMLInputElement | null;
  filterChipsEl: HTMLElement | null;
  loadMoreBtn: HTMLButtonElement | null;
  paginationCount: HTMLElement | null;
  paginationContainer: HTMLElement | null;
  panelCountNumber: HTMLElement | null;
  fabFilterCount: HTMLElement | null;
};

function asButton(el: unknown): HTMLButtonElement | null {
  return el instanceof HTMLButtonElement ? el : null;
}

export function pickElements(elements: any): Elements {
  return {
    list: elements.list ?? null,
    empty: elements.empty ?? null,
    countEl: elements.countEl ?? null,
    qEl: elements.qEl ?? null,
    filterChipsEl: elements.filterChipsEl ?? null,
    loadMoreBtn: asButton(elements.loadMoreBtn),
    paginationCount: elements.paginationCount ?? null,
    paginationContainer: elements.paginationContainer ?? null,
    panelCountNumber: elements.panelCountNumber ?? null,
    fabFilterCount: elements.fabFilterCount ?? null,
  };
}
