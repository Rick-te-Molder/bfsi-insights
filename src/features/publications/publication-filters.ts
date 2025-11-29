export default function initPublicationFilters() {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  const clearBtn = document.getElementById('clear-filters');
  const countEl = document.getElementById('count');
  const qEl = document.getElementById('q') as HTMLInputElement | null;
  const chipsEl = document.getElementById('chips');
  const badgeEl = document.getElementById('filter-count');
  const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement | null;
  const paginationCount = document.getElementById('pagination-count');
  const paginationContainer = document.getElementById('pagination-container');

  const STORAGE_KEY = 'publicationFiltersV1';
  const PAGE_SIZE = 30;
  const ADVANCED_FILTERS_KEY = 'advanced-filters-expanded';

  if (!list) return;

  const filterElements = Array.from(
    document.querySelectorAll<HTMLSelectElement>('select[id^="f-"]'),
  );

  const filters = filterElements.map((el) => ({
    key: el.id.replace(/^f-/, ''),
    el,
  }));

  if (filters.length === 0) {
    console.warn('No filters found in DOM');
    return;
  }

  type FilterValues = Record<string, string> & { q: string };

  interface IndexedItem {
    el: HTMLElement;
    title: string;
    source_name: string;
    authors: string;
    summary: string;
    tags_text: string;
    [key: string]: string | HTMLElement;
  }

  let currentPage = 1;

  const data: IndexedItem[] = Array.from(list.children).map((node) => {
    const el = node as HTMLElement;
    const heading = el.querySelector('h3')?.textContent?.trim() || '';
    const linkTitle = el.querySelector('a')?.textContent?.trim() || '';
    const item: IndexedItem = {
      el,
      title: heading || linkTitle,
      source_name: (el.querySelector('.mt-1') as HTMLElement | null)?.textContent || '',
      authors: el.getAttribute('data-authors') || '',
      summary:
        el.getAttribute('data-summary-medium') ||
        el.querySelector('p.text-sm')?.textContent?.trim() ||
        '',
      tags_text: [
        el.getAttribute('data-role') || '',
        el.getAttribute('data-industry') || '',
        el.getAttribute('data-topic') || '',
        el.getAttribute('data-content_type') || '',
        el.getAttribute('data-geography') || '',
      ]
        .filter(Boolean)
        .join(' '),
    };

    filters.forEach(({ key }) => {
      item[key] = el.getAttribute(`data-${key}`) || '';
    });

    return item;
  });

  let FuseCtor: any = null;
  (async () => {
    try {
      const mod = await import('fuse.js');
      FuseCtor = (mod as any)?.default || null;
    } catch {
      // optional
    }
  })();

  function getVals(): FilterValues {
    const vals: FilterValues = { q: '' };
    filters.forEach(({ key, el }) => {
      vals[key] = el.value || '';
    });
    vals.q = qEl?.value?.trim() || '';
    return vals;
  }

  function setVals(vals: FilterValues) {
    filters.forEach(({ key, el }) => {
      el.value = vals[key] || '';
    });
    if (qEl) qEl.value = vals.q || '';
  }

  function updateQuery(vals: FilterValues) {
    const params = new URLSearchParams();

    for (const [k, v] of Object.entries(vals)) {
      if (v && k !== 'q') params.set(k, v);
    }
    if (vals.q) params.set('q', vals.q);
    if (currentPage > 1) params.set('page', String(currentPage));

    const qs = params.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    history.replaceState(null, '', url);
  }

  function renderChipsSummary(vals: FilterValues) {
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
      button.addEventListener('click', () => {
        const current = getVals();
        current[key] = '';
        setVals(current);
        apply(current, true);
        renderChipsSummary(current);
      });
      chipsEl.appendChild(button);
    });

    const activeCount = entries.length + (vals.q?.trim() ? 1 : 0);
    if (badgeEl) badgeEl.textContent = String(activeCount);
  }

  function updatePaginationUI(visible: number, total: number) {
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

  function readFromQuery(): FilterValues {
    const params = new URLSearchParams(location.search);

    const vals: FilterValues = {
      q: params.get('q') || '',
    };

    filters.forEach(({ key }) => {
      vals[key] = params.get(key) || '';
    });

    const pageParam = params.get('page');
    if (pageParam) {
      const parsed = parseInt(pageParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        currentPage = parsed;
      }
    }

    const hasAnyParam = Object.values(vals).some((v) => v);

    if (!hasAnyParam) {
      try {
        const personaPref = localStorage.getItem('bfsi-persona-preference');
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
          const parsed = JSON.parse(saved) as FilterValues;

          vals.role =
            personaPref && personaPref !== 'all'
              ? personaPref
              : personaPref === 'all'
                ? 'all'
                : 'executive';

          vals.industry = parsed.industry || '';
          vals.topic = parsed.topic || '';
          vals.content_type = parsed.content_type || '';
          vals.geography = parsed.geography || '';
          vals.q = parsed.q || '';
        } else {
          if (personaPref && personaPref !== 'all') {
            vals.role = personaPref;
          } else if (!personaPref) {
            vals.role = 'executive';
          } else {
            vals.role = 'all';
          }
        }
      } catch {
        // ignore
      }
    } else if (!vals.role) {
      vals.role = 'all';
    }

    setVals(vals);
    return vals;
  }

  function apply(vals: FilterValues = getVals(), resetPage = false): number {
    if (resetPage) {
      currentPage = 1;
    }

    let visible = 0;
    let allowed = new Set<number>(data.map((_, i) => i));

    for (const { key } of filters) {
      const value = vals[key];
      if (!value || value === 'all') continue;

      const next = new Set<number>();
      allowed.forEach((idx) => {
        if (data[idx][key] === value) next.add(idx);
      });
      allowed = next;
    }

    if (vals.q) {
      if (FuseCtor) {
        const fuse = new FuseCtor(data, {
          includeScore: true,
          threshold: 0.2,
          keys: [
            { name: 'title', weight: 0.6 },
            { name: 'source_name', weight: 0.2 },
            { name: 'authors', weight: 0.1 },
            { name: 'summary', weight: 0.05 },
            { name: 'tags_text', weight: 0.05 },
          ],
        });

        const res = fuse.search(vals.q);
        const ids = new Set(res.map((r: any) => r.refIndex));
        allowed = new Set([...allowed].filter((i) => ids.has(i)));
      } else {
        const q = vals.q.toLowerCase();
        const match = (d: IndexedItem) =>
          d.title.toLowerCase().includes(q) ||
          d.source_name.toLowerCase().includes(q) ||
          d.authors.toLowerCase().includes(q) ||
          d.summary.toLowerCase().includes(q) ||
          d.tags_text.toLowerCase().includes(q);

        allowed = new Set([...allowed].filter((i) => match(data[i])));
      }
    }

    const filteredIndices = Array.from(allowed);
    const totalFiltered = filteredIndices.length;
    const visibleCount = Math.min(currentPage * PAGE_SIZE, totalFiltered);
    const visibleIndices = new Set(filteredIndices.slice(0, visibleCount));

    data.forEach((item, index) => {
      const isVisible = visibleIndices.has(index);
      item.el.classList.toggle('hidden', !isVisible);
      if (isVisible) visible++;
    });

    if (empty) empty.classList.toggle('hidden', totalFiltered !== 0);
    if (countEl) countEl.textContent = `Showing ${visible} of ${list.children.length}`;

    updatePaginationUI(visible, totalFiltered);
    updateQuery(vals);

    return visible;
  }

  const initVals = readFromQuery();
  apply(initVals);
  renderChipsSummary(initVals);

  filters.forEach(({ key, el }) => {
    el.addEventListener('change', () => {
      const vals = getVals();

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));
        if (key === 'role') {
          const roleVal = vals.role || 'all';
          localStorage.setItem('bfsi-persona-preference', roleVal);
        }
      } catch {}

      apply(vals, true);
      renderChipsSummary(vals);
    });
  });

  const debounced = (() => {
    let t: number | undefined;
    return (fn: () => void) => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(fn, 250);
    };
  })();

  qEl?.addEventListener('input', () =>
    debounced(() => {
      const vals = getVals();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));
      } catch {}
      apply(vals, true);
      renderChipsSummary(vals);
    }),
  );

  clearBtn?.addEventListener('click', () => {
    const cleared: FilterValues = {
      role: 'all',
      industry: '',
      topic: '',
      content_type: '',
      geography: '',
      q: '',
    };

    setVals(cleared);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}

    apply(getVals(), true);
    renderChipsSummary(getVals());
  });

  loadMoreBtn?.addEventListener('click', () => {
    currentPage++;
    apply(getVals(), false);

    const visibleItems = Array.from(list.children).filter(
      (el) => !(el as HTMLElement).classList.contains('hidden'),
    );
    const firstNewItem = visibleItems[(currentPage - 1) * PAGE_SIZE];
    if (firstNewItem) {
      (firstNewItem as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* Mobile Sheet */
  const openBtn = document.getElementById('open-sheet');
  const sheet = document.getElementById('filter-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const closeBtn = document.getElementById('close-sheet');
  const mobileSearchBtn = document.getElementById('mobile-search-btn');

  if (openBtn && sheet) {
    const desktop = {
      q: document.getElementById('q') as HTMLInputElement | null,
      role: document.getElementById('f-role') as HTMLSelectElement | null,
      industry: document.getElementById('f-industry') as HTMLSelectElement | null,
      topic: document.getElementById('f-topic') as HTMLSelectElement | null,
      content_type: document.getElementById('f-content_type') as HTMLSelectElement | null,
      geography: document.getElementById('f-geography') as HTMLSelectElement | null,
    } as const;

    const mobile = {
      q: document.getElementById('m-q') as HTMLInputElement | null,
      role: document.getElementById('m-f-role') as HTMLSelectElement | null,
      industry: document.getElementById('m-f-industry') as HTMLSelectElement | null,
      topic: document.getElementById('m-f-topic') as HTMLSelectElement | null,
      content_type: document.getElementById('m-f-content_type') as HTMLSelectElement | null,
      geography: document.getElementById('m-f-geography') as HTMLSelectElement | null,
    } as const;

    function getDesktopVals(): FilterValues {
      return {
        role: desktop.role?.value || '',
        industry: desktop.industry?.value || '',
        topic: desktop.topic?.value || '',
        content_type: desktop.content_type?.value || '',
        geography: desktop.geography?.value || '',
        q: desktop.q?.value?.trim() || '',
      };
    }

    function setDesktopVals(vals: FilterValues) {
      if (desktop.role) desktop.role.value = vals.role || '';
      if (desktop.industry) desktop.industry.value = vals.industry || '';
      if (desktop.topic) desktop.topic.value = vals.topic || '';
      if (desktop.content_type) desktop.content_type.value = vals.content_type || '';
      if (desktop.geography) desktop.geography.value = vals.geography || '';
      if (desktop.q) desktop.q.value = vals.q || '';
    }

    function syncToMobile() {
      const v = getDesktopVals();
      if (mobile.role) mobile.role.value = v.role;
      if (mobile.industry) mobile.industry.value = v.industry;
      if (mobile.topic) mobile.topic.value = v.topic;
      if (mobile.content_type) mobile.content_type.value = v.content_type;
      if (mobile.geography) mobile.geography.value = v.geography;
      if (mobile.q) mobile.q.value = v.q;
    }

    function applyFromDesktop() {
      ['role', 'industry', 'topic', 'content_type', 'geography'].forEach((k) => {
        const el = (desktop as any)[k] as HTMLSelectElement | null;
        if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      if (desktop.q) desktop.q.dispatchEvent(new Event('input', { bubbles: true }));
      renderChipsSummary(getDesktopVals());
    }

    function openSheet() {
      syncToMobile();
      sheet.classList.remove('hidden');
      sheet.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      mobile.role?.focus();
    }

    function closeSheet() {
      sheet.classList.add('hidden');
      sheet.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      (openBtn as HTMLElement).focus();
    }

    openBtn.addEventListener('click', openSheet);
    closeBtn?.addEventListener('click', closeSheet);
    backdrop?.addEventListener('click', closeSheet);

    window.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape' && !sheet.classList.contains('hidden')) {
        closeSheet();
      }
    });

    document.getElementById('m-clear')?.addEventListener('click', () => {
      const emptyVals: FilterValues = {
        role: '',
        industry: '',
        topic: '',
        content_type: '',
        geography: '',
        q: '',
      };
      setDesktopVals(emptyVals);
      currentPage = 1;
      applyFromDesktop();
      closeSheet();
    });

    document.getElementById('m-apply')?.addEventListener('click', () => {
      const vals: FilterValues = {
        role: mobile.role?.value || '',
        industry: mobile.industry?.value || '',
        topic: mobile.topic?.value || '',
        content_type: mobile.content_type?.value || '',
        geography: mobile.geography?.value || '',
        q: mobile.q?.value?.trim() || '',
      };
      setDesktopVals(vals);
      currentPage = 1;
      applyFromDesktop();
      closeSheet();
    });

    mobileSearchBtn?.addEventListener('click', () => {
      syncToMobile();
      sheet.classList.remove('hidden');
      sheet.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const searchInput = document.getElementById('m-q') as HTMLInputElement | null;
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    });

    renderChipsSummary(getDesktopVals());
  }

  const toggleAdvancedBtn = document.getElementById('toggle-advanced-filters');
  const advancedFilters = document.getElementById('advanced-filters');
  const advancedIcon = document.getElementById('advanced-filters-icon');

  function toggleAdvancedFilters() {
    if (!advancedFilters || !toggleAdvancedBtn || !advancedIcon) return;

    const isExpanded = toggleAdvancedBtn.getAttribute('aria-expanded') === 'true';
    const newState = !isExpanded;
    const buttonText = toggleAdvancedBtn.querySelector('span');

    if (newState) {
      advancedFilters.classList.remove('hidden');
      advancedIcon.classList.add('rotate-90');
      toggleAdvancedBtn.setAttribute('aria-expanded', 'true');
      if (buttonText) buttonText.textContent = 'Fewer filters';
    } else {
      advancedFilters.classList.add('hidden');
      advancedIcon.classList.remove('rotate-90');
      toggleAdvancedBtn.setAttribute('aria-expanded', 'false');
      if (buttonText) buttonText.textContent = 'More filters';
    }

    try {
      localStorage.setItem(ADVANCED_FILTERS_KEY, String(newState));
    } catch {}
  }

  try {
    const savedState = localStorage.getItem(ADVANCED_FILTERS_KEY);
    if (savedState === 'true' && advancedFilters && toggleAdvancedBtn && advancedIcon) {
      advancedFilters.classList.remove('hidden');
      advancedIcon.classList.add('rotate-90');
      toggleAdvancedBtn.setAttribute('aria-expanded', 'true');
      const buttonText = toggleAdvancedBtn.querySelector('span');
      if (buttonText) buttonText.textContent = 'Fewer filters';
    }
  } catch {}

  toggleAdvancedBtn?.addEventListener('click', toggleAdvancedFilters);
}
