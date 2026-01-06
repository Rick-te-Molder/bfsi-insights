import {
  type FilterState,
  type IndexedItem,
  matchesFilters,
  matchesSearch,
  sortIndices,
} from './filter-utils';

function collectMatchingIndices(data: IndexedItem[], state: FilterState, query: string) {
  const matchingIndices: number[] = [];
  data.forEach((item, index) => {
    if (matchesFilters(item, state) && matchesSearch(item, query)) matchingIndices.push(index);
  });
  return matchingIndices;
}

function computeVisibleIndices(matchingIndices: number[], currentPage: number, pageSize: number) {
  const totalMatching = matchingIndices.length;
  const visibleCount = Math.min(currentPage * pageSize, totalMatching);
  return { totalMatching, visibleIndices: matchingIndices.slice(0, visibleCount) };
}

function hideAllItems(data: IndexedItem[]) {
  data.forEach((item) => item.el.classList.add('hidden'));
}

function showVisibleItems(data: IndexedItem[], list: HTMLElement | null, visibleIndices: number[]) {
  let visible = 0;
  visibleIndices.forEach((index) => {
    const item = data[index];
    item.el.classList.remove('hidden');
    list?.appendChild(item.el);
    visible++;
  });
  return visible;
}

export function computeAndRenderResults({
  data,
  state,
  query,
  sortOrder,
  currentPage,
  pageSize,
  list,
}: {
  data: IndexedItem[];
  state: FilterState;
  query: string;
  sortOrder: string;
  currentPage: number;
  pageSize: number;
  list: HTMLElement | null;
}) {
  const matching = collectMatchingIndices(data, state, query);
  const matchingIndices = sortIndices(matching, data, sortOrder);
  const { totalMatching, visibleIndices } = computeVisibleIndices(
    matchingIndices,
    currentPage,
    pageSize,
  );

  hideAllItems(data);
  const visible = showVisibleItems(data, list, visibleIndices);
  return { totalMatching, visible };
}

export function updateResultUI({
  empty,
  countEl,
  panelCountNumber,
  totalMatching,
  visible,
}: {
  empty: HTMLElement | null;
  countEl: HTMLElement | null;
  panelCountNumber: HTMLElement | null;
  totalMatching: number;
  visible: number;
}) {
  empty?.classList.toggle('hidden', totalMatching !== 0);
  if (countEl) countEl.textContent = `Showing ${visible} of ${totalMatching} publications`;
  if (panelCountNumber) panelCountNumber.textContent = String(totalMatching);
}
