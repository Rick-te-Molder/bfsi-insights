export function updatePaginationUI(
  visible: number,
  total: number,
  loadMoreBtn: HTMLButtonElement | null,
  paginationCount: HTMLElement | null,
  paginationContainer: HTMLElement | null,
) {
  if (!loadMoreBtn || !paginationCount || !paginationContainer) return;

  if (total === 0) {
    paginationContainer.classList.add('hidden');
    return;
  }

  paginationContainer.classList.remove('hidden');
  paginationCount.textContent = `Showing ${visible} of ${total} publications`;

  if (visible < total) {
    loadMoreBtn.classList.remove('hidden');
  } else {
    loadMoreBtn.classList.add('hidden');
  }
}

export function showLoadingState(
  searchSpinner: HTMLElement | null,
  fabIcon: HTMLElement | null,
  fabSpinner: HTMLElement | null,
  list: HTMLElement | null,
) {
  searchSpinner?.classList.remove('hidden');
  if (fabIcon && fabSpinner) {
    fabIcon.classList.add('hidden');
    fabSpinner.classList.remove('hidden');
  }
  if (list) list.style.opacity = '0.5';
}

export function hideLoadingState(
  searchSpinner: HTMLElement | null,
  fabIcon: HTMLElement | null,
  fabSpinner: HTMLElement | null,
  list: HTMLElement | null,
) {
  searchSpinner?.classList.add('hidden');
  if (fabIcon && fabSpinner) {
    fabIcon.classList.remove('hidden');
    fabSpinner.classList.add('hidden');
  }
  if (list) list.style.opacity = '1';
}

export function revealList(loadingSkeleton: HTMLElement | null, list: HTMLElement | null) {
  loadingSkeleton?.classList.add('hidden');
  if (list) {
    list.classList.remove('opacity-0');
    list.style.opacity = '1';
  }
}

export function openPanel(
  filterPanel: HTMLElement | null,
  panelCountNumber: HTMLElement | null,
  count: number,
) {
  if (!filterPanel) return;
  filterPanel.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (panelCountNumber) panelCountNumber.textContent = String(count);
}

export function closePanel(filterPanel: HTMLElement | null) {
  if (!filterPanel) return;
  filterPanel.classList.add('hidden');
  document.body.style.overflow = '';
}

export function updateDateDisplay(sortOrder: string) {
  const isAddedSort = sortOrder.startsWith('date_added');
  document.querySelectorAll('.date-display').forEach((el) => {
    const label = el.querySelector('.date-label');
    const value = el.querySelector('.date-value');
    if (label && value) {
      const dateEl = el as HTMLElement;
      if (isAddedSort) {
        label.textContent = 'Added';
        value.textContent = dateEl.dataset.added || dateEl.dataset.published || '';
      } else {
        label.textContent = 'Published';
        value.textContent = dateEl.dataset.published || '';
      }
    }
  });
}

export function createDebouncer(
  showLoading: () => void,
  hideLoading: () => void,
): (fn: () => void) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (fn: () => void) => {
    if (t) clearTimeout(t);
    showLoading();
    t = setTimeout(() => {
      fn();
      hideLoading();
    }, 250);
  };
}
