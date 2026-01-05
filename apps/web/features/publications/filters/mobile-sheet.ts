/**
 * Mobile Filter Sheet
 *
 * Handles the mobile filter sheet UI and interactions.
 */

import type { FilterValues } from './types';
import { getVals, setVals, saveToStorage } from './storage';
import { renderChipsSummary } from './ui';
import { createDebouncer } from './search';

interface MobileElements {
  q: HTMLInputElement | null;
  role: HTMLSelectElement | null;
  industry: HTMLSelectElement | null;
  topic: HTMLSelectElement | null;
  content_type: HTMLSelectElement | null;
  geography: HTMLSelectElement | null;
}

interface FilterElement {
  key: string;
  el: HTMLSelectElement;
}

interface MobileSheetDeps {
  list: HTMLElement;
  qEl: HTMLInputElement | null;
  mobileSearchEl: HTMLInputElement | null;
  chipsEl: HTMLElement | null;
  badgeEl: HTMLElement | null;
  filters: FilterElement[];
  apply: (vals?: FilterValues, resetPage?: boolean) => number;
  setCurrentPage: (page: number) => void;
}

/** Get desktop filter elements */
function getDesktopElements(): MobileElements {
  return {
    q: document.getElementById('q') as HTMLInputElement | null,
    role: document.getElementById('f-role') as HTMLSelectElement | null,
    industry: document.getElementById('f-industry') as HTMLSelectElement | null,
    topic: document.getElementById('f-topic') as HTMLSelectElement | null,
    content_type: document.getElementById('f-content_type') as HTMLSelectElement | null,
    geography: document.getElementById('f-geography') as HTMLSelectElement | null,
  };
}

/** Get mobile filter elements */
function getMobileElements(): MobileElements {
  return {
    q: document.getElementById('m-q') as HTMLInputElement | null,
    role: document.getElementById('m-f-role') as HTMLSelectElement | null,
    industry: document.getElementById('m-f-industry') as HTMLSelectElement | null,
    topic: document.getElementById('m-f-topic') as HTMLSelectElement | null,
    content_type: document.getElementById('m-f-content_type') as HTMLSelectElement | null,
    geography: document.getElementById('m-f-geography') as HTMLSelectElement | null,
  };
}

/** Get values from mobile elements */
function getMobileVals(
  mobile: MobileElements,
  mobileSearchEl: HTMLInputElement | null,
): FilterValues {
  return {
    role: mobile.role?.value || '',
    industry: mobile.industry?.value || '',
    topic: mobile.topic?.value || '',
    content_type: mobile.content_type?.value || '',
    geography: mobile.geography?.value || '',
    q: mobile.q?.value?.trim() || mobileSearchEl?.value?.trim() || '',
  };
}

/** Set values on desktop elements */
function setDesktopVals(desktop: MobileElements, vals: FilterValues) {
  if (desktop.role) desktop.role.value = vals.role || '';
  if (desktop.industry) desktop.industry.value = vals.industry || '';
  if (desktop.topic) desktop.topic.value = vals.topic || '';
  if (desktop.content_type) desktop.content_type.value = vals.content_type || '';
  if (desktop.geography) desktop.geography.value = vals.geography || '';
  if (desktop.q) desktop.q.value = vals.q || '';
}

/** Sync values to mobile elements */
function syncToMobile(mobile: MobileElements, vals: FilterValues) {
  if (mobile.role) mobile.role.value = vals.role || '';
  if (mobile.industry) mobile.industry.value = vals.industry || '';
  if (mobile.topic) mobile.topic.value = vals.topic || '';
  if (mobile.content_type) mobile.content_type.value = vals.content_type || '';
  if (mobile.geography) mobile.geography.value = vals.geography || '';
  if (mobile.q) mobile.q.value = vals.q || '';
}

/** Clear all mobile filter values */
function clearMobileVals(mobile: MobileElements) {
  if (mobile.role) mobile.role.value = '';
  if (mobile.industry) mobile.industry.value = '';
  if (mobile.topic) mobile.topic.value = '';
  if (mobile.content_type) mobile.content_type.value = '';
  if (mobile.geography) mobile.geography.value = '';
  if (mobile.q) mobile.q.value = '';
}

/** Count visible items in list */
function countVisibleItems(list: HTMLElement): number {
  return Array.from(list.children).filter((el) => !(el as HTMLElement).classList.contains('hidden'))
    .length;
}

interface SheetElements {
  openBtn: HTMLElement;
  sheet: HTMLElement;
  backdrop: HTMLElement | null;
  closeBtn: HTMLElement | null;
  mobileResultNumber: HTMLElement | null;
}

/** Get sheet DOM elements */
function getSheetElements(): SheetElements | null {
  const openBtn = document.getElementById('open-sheet');
  const sheet = document.getElementById('filter-sheet');
  if (!openBtn || !sheet) return null;

  return {
    openBtn,
    sheet,
    backdrop: document.getElementById('sheet-backdrop'),
    closeBtn: document.getElementById('close-sheet'),
    mobileResultNumber: document.getElementById('m-result-number'),
  };
}

/** Create open sheet handler */
function createOpenHandler(
  sheet: HTMLElement,
  mobile: MobileElements,
  deps: MobileSheetDeps,
  updateCount: (n: number) => void,
) {
  return () => {
    const v = getVals(deps.filters, deps.qEl, deps.mobileSearchEl);
    syncToMobile(mobile, v);
    updateCount(countVisibleItems(deps.list));
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    mobile.role?.focus();
  };
}

/** Create close sheet handler */
function createCloseHandler(sheet: HTMLElement, openBtn: HTMLElement) {
  return () => {
    sheet.classList.add('hidden');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    openBtn.focus();
  };
}

/** Setup sheet event listeners */
function setupSheetListeners(els: SheetElements, openSheet: () => void, closeSheet: () => void) {
  els.openBtn.addEventListener('click', openSheet);
  els.closeBtn?.addEventListener('click', closeSheet);
  els.backdrop?.addEventListener('click', closeSheet);
  globalThis.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !els.sheet.classList.contains('hidden')) closeSheet();
  });
}

/** Setup mobile filter input handlers */
function setupMobileInputHandlers(mobile: MobileElements, applyFromMobile: () => void) {
  const debounced = createDebouncer();
  Object.values(mobile).forEach((el) => {
    if (el instanceof HTMLSelectElement) {
      el.addEventListener('change', applyFromMobile);
    } else if (el instanceof HTMLInputElement) {
      el.addEventListener('input', () => debounced(applyFromMobile, false));
    }
  });
}

/** Create apply from mobile handler */
function createApplyFromMobile(
  mobile: MobileElements,
  desktop: MobileElements,
  deps: MobileSheetDeps,
  updateCount: (n: number) => void,
) {
  return () => {
    const vals = getMobileVals(mobile, deps.mobileSearchEl);
    setDesktopVals(desktop, vals);
    setVals(vals, deps.filters, deps.qEl, deps.mobileSearchEl);
    deps.setCurrentPage(1);
    updateCount(deps.apply(vals, true));
    renderChipsSummary(vals, deps.chipsEl, deps.badgeEl, () => {});
    saveToStorage(vals);
  };
}

/** Setup clear and done button handlers */
function setupClearDoneButtons(
  mobile: MobileElements,
  applyFromMobile: () => void,
  closeSheet: () => void,
) {
  document.getElementById('m-clear')?.addEventListener('click', () => {
    clearMobileVals(mobile);
    applyFromMobile();
  });
  document.getElementById('m-done')?.addEventListener('click', closeSheet);
}

/** Setup mobile filter sheet */
export function setupMobileSheet(deps: MobileSheetDeps) {
  const els = getSheetElements();
  if (!els) return;

  const desktop = getDesktopElements();
  const mobile = getMobileElements();
  const updateCount = (n: number) => {
    if (els.mobileResultNumber) els.mobileResultNumber.textContent = String(n);
  };

  const applyFromMobile = createApplyFromMobile(mobile, desktop, deps, updateCount);
  const openSheet = createOpenHandler(els.sheet, mobile, deps, updateCount);
  const closeSheet = createCloseHandler(els.sheet, els.openBtn);

  setupSheetListeners(els, openSheet, closeSheet);
  setupMobileInputHandlers(mobile, applyFromMobile);
  setupClearDoneButtons(mobile, applyFromMobile, closeSheet);
  renderChipsSummary(
    getVals(deps.filters, deps.qEl, deps.mobileSearchEl),
    deps.chipsEl,
    deps.badgeEl,
    () => {},
  );
}
