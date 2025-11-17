export default function initResourceFilters() {
  const $ = (id: string) => document.getElementById(id);
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  const clearBtn = document.getElementById('clear-filters');
  const countEl = document.getElementById('count');
  const qEl = document.getElementById('q') as HTMLInputElement | null;
  const chipsEl = document.getElementById('chips');
  const badgeEl = document.getElementById('filter-count');
  const filters = ['role', 'industry', 'topic', 'content_type', 'geography'].map((f) => ({
    key: f,
    el: $(`f-${f}`) as HTMLSelectElement | null,
  }));

  const STORAGE_KEY = 'resourcesFiltersV1';
  if (!list) return;

  const renderChipsSummary = (vals: Record<string, string>) => {
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    const entries = Object.entries(vals).filter(([k, v]) => k !== 'q' && v && v !== 'all');
    entries.forEach(([k, v]) => {
      const button = document.createElement('button');
      button.className =
        'rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-800';
      const displayValue = v.charAt(0).toUpperCase() + v.slice(1);
      button.textContent = `${k.replace('_', ' ')}: ${displayValue} ✕`;
      button.addEventListener('click', () => {
        const current = getVals();
        current[k] = '';
        setVals(current);
        apply(current);
        renderChipsSummary(current);
      });
      chipsEl.appendChild(button);
    });
    const activeCount = entries.length + (vals.q?.trim() ? 1 : 0);
    if (badgeEl) badgeEl.textContent = String(activeCount);
  };

  // Build an index of items from the DOM data attributes
  const data = Array.from(list.children).map((li) => {
    const el = li as HTMLElement;
    return {
      el,
      title: el.querySelector('a')?.textContent?.trim() || '',
      source_name: (el.querySelector('.mt-1') as HTMLElement)?.textContent || '',
      authors: el.getAttribute('data-authors') || '',
      role: el.getAttribute('data-role') || '',
      industry: el.getAttribute('data-industry') || '',
      topic: el.getAttribute('data-topic') || '',
      content_type: el.getAttribute('data-content_type') || '',
      geography: el.getAttribute('data-geography') || '',
    };
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

  function getVals() {
    const vals: Record<string, string> = {};
    filters.forEach(({ key, el }) => (vals[key] = (el as HTMLSelectElement)?.value || ''));
    vals.q = qEl?.value?.trim() || '';
    return vals;
  }
  function setVals(vals: Record<string, string>) {
    filters.forEach(({ key, el }) => {
      if (el) el.value = vals[key] || '';
    });
    if (qEl) qEl.value = vals.q || '';
  }
  function updateQuery(vals: Record<string, string>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(vals)) if (v && k !== 'q') params.set(k, v);
    if (vals.q) params.set('q', vals.q);
    const qs = params.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    history.replaceState(null, '', url);
  }
  function readFromQuery() {
    const params = new URLSearchParams(location.search);
    const vals: Record<string, string> = Object.fromEntries([
      ...filters.map(({ key }) => [key, params.get(key) || '']),
      ['q', params.get('q') || ''],
    ]);
    const hasAnyParam = Object.values(vals).some((v) => v);

    // If no URL params, check localStorage or persona preference
    if (!hasAnyParam) {
      try {
        // ALWAYS check persona preference first (syncs with homepage)
        const personaPref = localStorage.getItem('bfsi-persona-preference');
        console.log('Resources: Read persona preference:', personaPref);

        // Then check saved filters for other fields
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('Resources: Loaded saved filters:', parsed);
          // Use saved filters but override role with persona preference
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
          // No saved filters - use persona preference or default
          if (personaPref && personaPref !== 'all') {
            vals.role = personaPref;
          } else if (!personaPref) {
            vals.role = 'executive';
          } else {
            vals.role = 'all';
          }
        }
        console.log('Resources: Setting role to:', vals.role);
      } catch {
        /* ignore */
      }
    } else {
      // Set defaults for empty URL params
      if (!vals.role) vals.role = 'all';
    }

    setVals(vals);
    return vals;
  }
  function apply(vals = getVals()) {
    let visible = 0;
    let allowed = new Set(data.map((_, i) => i));
    // dropdown filters
    for (const { key } of filters) {
      const v = (vals as any)[key];
      if (!v || v === 'all') continue;
      const next = new Set<number>();
      allowed.forEach((idx) => {
        if ((data as any)[idx][key] === v) next.add(idx);
      });
      allowed = next;
    }
    // text search
    if (vals.q) {
      if (FuseCtor) {
        const fuse = new FuseCtor(data, {
          includeScore: true,
          threshold: 0.35,
          keys: [
            { name: 'title', weight: 0.6 },
            { name: 'source_name', weight: 0.2 },
            { name: 'authors', weight: 0.2 },
          ],
        });
        const res = fuse.search(vals.q);
        const ids = new Set(res.map((r: any) => r.refIndex));
        allowed = new Set([...allowed].filter((i) => ids.has(i)));
      } else {
        const q = vals.q.toLowerCase();
        const match = (d: any) =>
          d.title.toLowerCase().includes(q) ||
          d.source_name.toLowerCase().includes(q) ||
          d.authors.toLowerCase().includes(q);
        allowed = new Set([...allowed].filter((i) => match((data as any)[i])));
      }
    }
    // render
    data.forEach((d, i) => {
      const ok = allowed.has(i);
      d.el.classList.toggle('hidden', !ok);
      if (ok) visible++;
    });
    if (empty) empty.classList.toggle('hidden', visible !== 0);
    if (countEl) countEl.textContent = `Showing ${visible} of ${list.children.length}`;
    return visible;
  }

  // init from query
  const initVals = readFromQuery();
  apply(initVals);
  renderChipsSummary(initVals);
  // events
  filters.forEach(({ key, el }) =>
    el?.addEventListener('change', () => {
      const vals = getVals();
      updateQuery(vals);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));

        // Sync role filter with homepage persona preference
        if (key === 'role') {
          const roleVal = vals.role || 'all';
          localStorage.setItem('bfsi-persona-preference', roleVal);
        }
      } catch {
        /* ignore */
      }
      apply(vals);
      renderChipsSummary(vals);
    }),
  );
  const debounced = (() => {
    let t: any;
    return (fn: () => void) => {
      clearTimeout(t);
      t = setTimeout(fn, 250);
    };
  })();
  qEl?.addEventListener('input', () =>
    debounced(() => {
      const vals = getVals();
      updateQuery(vals);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));
      } catch {
        /* ignore */
      }
      apply(vals);
    }),
  );
  clearBtn?.addEventListener('click', () => {
    setVals({ role: 'all', industry: '', topic: '', content_type: '', geography: '', q: '' });
    updateQuery(getVals());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    apply();
    renderChipsSummary(getVals());
  });

  // Mobile bottom-sheet controls
  const openBtn = document.getElementById('open-sheet');
  const sheet = document.getElementById('filter-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const closeBtn = document.getElementById('close-sheet');
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

    function getDesktopVals() {
      return {
        role: desktop.role?.value || '',
        industry: desktop.industry?.value || '',
        topic: desktop.topic?.value || '',
        content_type: desktop.content_type?.value || '',
        geography: desktop.geography?.value || '',
        q: desktop.q?.value?.trim() || '',
      };
    }
    function setDesktopVals(vals: Record<string, string>) {
      if (desktop.role) desktop.role.value = vals.role || '';
      if (desktop.industry) desktop.industry.value = vals.industry || '';
      if (desktop.topic) desktop.topic.value = vals.topic || '';
      if (desktop.content_type) desktop.content_type.value = vals.content_type || '';
      if (desktop.geography) desktop.geography.value = vals.geography || '';
      if (desktop.q) desktop.q.value = vals.q || '';
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
      (document.body as HTMLBodyElement).style.overflow = 'hidden';
      mobile.role?.focus();
    }
    function closeSheet() {
      sheet.classList.add('hidden');
      sheet.setAttribute('aria-hidden', 'true');
      (document.body as HTMLBodyElement).style.overflow = '';
      (openBtn as HTMLElement).focus();
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

    openBtn.addEventListener('click', openSheet);
    closeBtn?.addEventListener('click', closeSheet);
    backdrop?.addEventListener('click', closeSheet);
    window.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape' && sheet && !sheet.classList.contains('hidden'))
        closeSheet();
    });

    document.getElementById('m-clear')?.addEventListener('click', () => {
      const empty = {
        role: '',
        industry: '',
        topic: '',
        content_type: '',
        geography: '',
        q: '',
      };
      setDesktopVals(empty);
      applyFromDesktop();
      closeSheet();
    });
    document.getElementById('m-apply')?.addEventListener('click', () => {
      const vals = {
        role: mobile.role?.value || '',
        industry: mobile.industry?.value || '',
        topic: mobile.topic?.value || '',
        content_type: mobile.content_type?.value || '',
        geography: mobile.geography?.value || '',
        q: mobile.q?.value?.trim() || '',
      };
      setDesktopVals(vals);
      applyFromDesktop();
      closeSheet();
    });

    renderChips(getDesktopVals());
  }
}
