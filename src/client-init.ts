// Inline linkify function
function linkify(text?: string): string {
  if (!text) return '';
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const urlRe = /(https?:\/\/[\w.-]+(?:\.[\w.-]+)+(?:[:#?/=][^\s]*)?)/gi;
  return text.replace(urlRe, (u) => {
    const h = escapeHtml(u);
    return `<a href="${h}" target="_blank" rel="noopener" class="text-sky-300 underline underline-offset-2">${h}</a>`;
  });
}

// Import and inline resource-modal
function initResourceModal() {
  let lastFocus: Element | null = null;
  let focusTrapHandler: ((e: FocusEvent) => void) | null = null;

  function nextSrc(el: HTMLImageElement): string | null {
    const n = el.dataset.next || '';
    if (!n) return null;
    const parts = n.split('|');
    const nx = parts.shift();
    el.dataset.next = parts.join('|');
    return nx || null;
  }

  function openModalFrom(li: HTMLElement) {
    const title = li.querySelector('a')?.textContent?.trim() || '';
    const meta = (li.querySelector('.mt-1') as HTMLElement)?.textContent?.trim() || '';
    const p =
      (li.querySelector('p.text-sm') as HTMLElement) || (li.querySelector('p') as HTMLElement);
    const note = p?.textContent || '';
    const img = li.querySelector('img') as HTMLImageElement | null;
    const link = (li.querySelector('a') as HTMLAnchorElement)?.href || '#';
    const external = li.getAttribute('data-url') || '#';
    const slug = li.getAttribute('data-slug') || '';
    const sourceName =
      li.getAttribute('data-source_name') || li.getAttribute('data-source') || 'original';
    const tags = [
      li.getAttribute('data-role') || '',
      li.getAttribute('data-industry') || '',
      li.getAttribute('data-topic') || '',
      li.getAttribute('data-content_type') || '',
      li.getAttribute('data-geography') || '',
    ].filter(Boolean);

    const m = document.getElementById('modal')!;
    lastFocus = document.activeElement;
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const titleA = document.getElementById('modal-title-link') as HTMLAnchorElement;
    titleA.textContent = title;
    titleA.href = link;

    const metaEl = document.getElementById('modal-meta') as HTMLElement;
    metaEl.textContent = meta;
    metaEl.style.display = meta && meta.trim() ? '' : 'none';

    const noteHtml = linkify(note.replace(/\(more\)\s*$/, ''));
    const noteEl = document.getElementById('modal-note') as HTMLElement;
    noteEl.innerHTML = noteHtml;

    const tagsEl = document.getElementById('modal-tags') as HTMLElement;
    tagsEl.innerHTML = '';
    tags.forEach((t) => {
      const b = document.createElement('span');
      b.className =
        'rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-300';
      b.textContent = t;
      tagsEl.appendChild(b);
    });

    const viewA = document.getElementById('modal-view-details') as HTMLAnchorElement | null;
    if (viewA) viewA.setAttribute('href', slug ? `/${slug}` : link);
    const a = document.getElementById('modal-link') as HTMLAnchorElement;
    a.href = external || link;
    const srcEl = document.getElementById('modal-source') as HTMLElement | null;
    if (srcEl) srcEl.textContent = sourceName || 'original';

    const mi = document.getElementById('modal-img') as HTMLImageElement;
    const makeCandidates = () => {
      const slug = li.getAttribute('data-slug') || '';
      const thumb = li.getAttribute('data-thumbnail') || '';
      const url = li.getAttribute('data-url') || '';
      const arr: string[] = [];
      if (thumb) {
        if (/\.(webp|png|jpe?g)$/i.test(thumb)) arr.push(thumb);
        else arr.push(`${thumb}.webp`, `${thumb}.png`, `${thumb}.jpg`);
      }
      if (slug) arr.push(`/thumbs/${slug}.png`, `/thumbs/${slug}.webp`, `/thumbs/${slug}.jpg`);
      if (url)
        arr.push(`https://image.thum.io/get/nojs/width/960/crop/960/${encodeURIComponent(url)}`);
      return Array.from(new Set(arr));
    };
    const cand = makeCandidates();
    if (cand.length) {
      mi.src = cand[0];
      mi.dataset.next = cand.slice(1).join('|');
    } else if (img) {
      mi.src = (img as any).currentSrc || img.src;
      mi.dataset.next = img.dataset.next || '';
    }
    mi.onerror = () => {
      const nx = nextSrc(mi);
      if (nx) mi.src = nx;
    };

    const closeBtn = document.getElementById('modal-close') as HTMLButtonElement;
    closeBtn.focus();
    focusTrapHandler = (e: FocusEvent) => {
      if (!m.contains(e.target as Node)) {
        e.stopPropagation();
        closeBtn.focus();
      }
    };
    window.addEventListener('focusin', focusTrapHandler);
  }

  function closeModal() {
    const m = document.getElementById('modal')!;
    m.classList.add('hidden');
    document.body.style.overflow = '';
    if (focusTrapHandler) window.removeEventListener('focusin', focusTrapHandler);
    if (lastFocus && (lastFocus as any).focus) (lastFocus as any).focus();
  }

  (window as any).openModalFrom = openModalFrom;
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  });

  const mark = (el: Element, key: string) =>
    el instanceof HTMLElement ? (el.dataset[key] = '1') : undefined;
  const isMarked = (el: Element, key: string) =>
    el instanceof HTMLElement ? el.dataset[key] === '1' : false;

  function attachToCard(li: HTMLElement) {
    if (isMarked(li, 'modalBound')) return;
    li.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-open-modal]')) return;
      if (t.closest('a[id^="t-"]')) return;
      openModalFrom(li);
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModalFrom(li);
      }
    });
    mark(li, 'modalBound');
  }

  function attachToButton(btn: HTMLElement) {
    if (isMarked(btn, 'modalBtnBound')) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const li = btn.closest('li.group') as HTMLElement | null;
      if (li) openModalFrom(li);
    });
    mark(btn, 'modalBtnBound');
  }

  Array.from(document.querySelectorAll('li.group')).forEach((el) =>
    attachToCard(el as HTMLElement),
  );
  Array.from(document.querySelectorAll('[data-open-modal]')).forEach((el) =>
    attachToButton(el as HTMLElement),
  );

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches && n.matches('li.group')) attachToCard(n as HTMLElement);
        n.querySelectorAll &&
          n.querySelectorAll('li.group').forEach((el) => attachToCard(el as HTMLElement));
        if (n.matches && n.matches('[data-open-modal]')) attachToButton(n as HTMLElement);
        n.querySelectorAll &&
          n
            .querySelectorAll('[data-open-modal]')
            .forEach((el) => attachToButton(el as HTMLElement));
      });
    }
  });
  mo.observe(document.documentElement, { subtree: true, childList: true });

  window.addEventListener(
    'click',
    (e) => {
      const node = e.target as Node;
      const el = node instanceof Element ? node : (node.parentElement as Element | null);
      if (!el) return;
      const btn = el.closest('[data-open-modal]') as HTMLElement | null;
      const li = el.closest('li.group') as HTMLElement | null;
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const li = btn.closest('li.group') as HTMLElement | null;
        if (li) openModalFrom(li);
        return;
      }
      if (!li) return;
      if (el.closest('a[id^="t-"]')) return;
      openModalFrom(li);
    },
    { capture: true },
  );

  document.addEventListener('keydown', (e) => {
    const li = (e.target as HTMLElement).closest('li.group') as HTMLElement | null;
    if (!li) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModalFrom(li);
    }
  });
}

// Inline resource-filters - simplified version
function initResourceFilters() {
  // Implementation loaded from separate script on resources page only
}

function enhanceImages(root: Document | Element = document) {
  const imgs = Array.from(root.querySelectorAll('li.group img'));
  imgs.forEach((img) => {
    const placeholder = img.previousElementSibling;
    const onload = () => {
      img.classList.remove('opacity-0');
      if (placeholder && placeholder instanceof HTMLElement) placeholder.style.display = 'none';
    };
    const onerror = () => {
      const imgEl = img as HTMLImageElement;
      const n = (imgEl.dataset && imgEl.dataset.next) || '';
      if (n) {
        const parts = n.split('|');
        const nx = parts.shift();
        imgEl.dataset.next = parts.join('|');
        if (nx) {
          imgEl.src = nx;
          return;
        }
      }
      imgEl.style.display = 'none';
      if (placeholder && placeholder instanceof HTMLElement) placeholder.style.display = 'none';
    };
    img.addEventListener('load', onload, { once: true });
    img.addEventListener('error', onerror);
    const imgEl = img as HTMLImageElement;
    if (imgEl.complete) {
      if (imgEl.naturalWidth > 0) onload();
      else onerror();
    }
  });
}

function init() {
  initResourceModal();
  enhanceImages();
  if (document.getElementById('list')) initResourceFilters();
}

if (document.readyState !== 'loading') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
