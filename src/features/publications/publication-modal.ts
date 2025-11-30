function nextSrc(el: HTMLImageElement): string | null {
  const n = el.dataset.next || '';
  if (!n) return null;
  const parts = n.split('|');
  const nx = parts.shift();
  el.dataset.next = parts.join('|');
  return nx || null;
}

import { linkify } from '../../lib/text';

let lastFocus: Element | null = null;
let focusTrapHandler: ((e: FocusEvent) => void) | null = null;

function openModalFrom(li: HTMLElement) {
  const title = li.querySelector('a')?.textContent?.trim() || '';
  const meta = (li.querySelector('.mt-1') as HTMLElement)?.textContent?.trim() || '';
  const p =
    (li.querySelector('p.text-sm') as HTMLElement) || (li.querySelector('p') as HTMLElement);
  const summary = p?.textContent || '';

  const link = (li.querySelector('a') as HTMLAnchorElement)?.href || '#';
  const slug = li.dataset.slug || '';

  const tags = [
    li.dataset.role || '',
    li.dataset.industry || '',
    li.dataset.topic || '',
    li.dataset.content_type || '',
    li.dataset.geography || '',
  ].filter(Boolean);

  const modal = document.getElementById('modal');
  if (!modal) return;

  lastFocus = document.activeElement;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const titleEl = document.getElementById('modal-title-text');
  if (titleEl) titleEl.textContent = title;

  const metaEl = document.getElementById('modal-meta');
  if (metaEl) {
    metaEl.textContent = meta;
    metaEl.style.display = meta && meta.trim() ? '' : 'none';
  }

  const summaryHtml = linkify(summary.replace(/\(more\)\s*$/, ''));
  const summaryEl = document.getElementById('modal-summary');
  if (summaryEl) summaryEl.innerHTML = summaryHtml;

  const tagsEl = document.getElementById('modal-tags');
  if (tagsEl) {
    tagsEl.innerHTML = '';
    tags.forEach((t) => {
      const b = document.createElement('span');
      b.className =
        'rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-300';
      b.textContent = t;
      tagsEl.appendChild(b);
    });
  }

  const viewA = document.getElementById('modal-view-details') as HTMLAnchorElement | null;
  if (viewA) viewA.href = slug ? `/${slug}` : link;

  const img = li.querySelector('img') as HTMLImageElement | null;
  const modalImg = document.getElementById('modal-img') as HTMLImageElement | null;
  if (!modalImg) return;

  const thumb = li.dataset.thumbnail || '';
  const cand: string[] = [];

  if (thumb) {
    if (/\.(webp|png|jpe?g)$/i.test(thumb)) cand.push(thumb);
    else cand.push(`${thumb}.webp`, `${thumb}.png`, `${thumb}.jpg`);
  }

  // Disable implicit guessing based on slug
  // if (slugVal)
  //   cand.push(`/thumbs/${slugVal}.png`, `/thumbs/${slugVal}.webp`, `/thumbs/${slugVal}.jpg`);

  const dedup = Array.from(new Set(cand));

  if (dedup.length) {
    modalImg.src = dedup[0];
    modalImg.dataset.next = dedup.slice(1).join('|');
  } else if (img) {
    modalImg.src = img.currentSrc || img.src;
    modalImg.dataset.next = img.dataset.next || '';
  }

  modalImg.onerror = () => {
    const nx = nextSrc(modalImg);
    if (nx) modalImg.src = nx;
  };

  const closeBtn = document.getElementById('modal-close') as HTMLButtonElement | null;
  if (closeBtn) closeBtn.focus();

  focusTrapHandler = (e: FocusEvent) => {
    if (!modal.contains(e.target as Node)) {
      e.stopPropagation();
      if (closeBtn) closeBtn.focus();
    }
  };

  globalThis.addEventListener('focusin', focusTrapHandler);
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (!modal) return;

  modal.classList.add('hidden');
  document.body.style.overflow = '';

  if (focusTrapHandler) globalThis.removeEventListener('focusin', focusTrapHandler);
  if (lastFocus && lastFocus instanceof HTMLElement) lastFocus.focus();
}

export default function initPublicationModal() {
  (window as any).openModalFrom = openModalFrom;

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);

  globalThis.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  });

  function bindCard(li: HTMLElement) {
    li.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-open-modal]')) return;
      if ((e.target as HTMLElement).closest("a[id^='t-']")) return;
      openModalFrom(li);
    });

    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModalFrom(li);
      }
    });
  }

  function bindButton(btn: HTMLElement) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const li = btn.closest('li.group') as HTMLElement;
      openModalFrom(li);
    });
  }

  document.querySelectorAll('li.group').forEach((el) => bindCard(el as HTMLElement));
  document.querySelectorAll('[data-open-modal]').forEach((el) => bindButton(el as HTMLElement));

  const mo = new MutationObserver((muts) => {
    muts.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;

        if (n.matches('li.group')) bindCard(n as HTMLElement);
        n.querySelectorAll?.('li.group').forEach((el) => bindCard(el as HTMLElement));

        if (n.matches('[data-open-modal]')) bindButton(n as HTMLElement);
        n.querySelectorAll?.('[data-open-modal]').forEach((el) => bindButton(el as HTMLElement));
      });
    });
  });

  mo.observe(document.documentElement, { subtree: true, childList: true });
}
