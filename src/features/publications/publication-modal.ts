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
  const slug = li.getAttribute('data-slug') || '';
  const external = li.getAttribute('data-url') || '#';
  const sourceName = li.getAttribute('data-source_name') || 'original';

  const tags = [
    li.getAttribute('data-role') || '',
    li.getAttribute('data-industry') || '',
    li.getAttribute('data-topic') || '',
    li.getAttribute('data-content_type') || '',
    li.getAttribute('data-geography') || '',
  ].filter(Boolean);

  const modal = document.getElementById('modal')!;
  lastFocus = document.activeElement;
  modal.classList.remove('hidden');
  (document.body as HTMLBodyElement).style.overflow = 'hidden';

  const titleEl = document.getElementById('modal-title-text') as HTMLElement;
  titleEl.textContent = title;

  const metaEl = document.getElementById('modal-meta') as HTMLElement;
  metaEl.textContent = meta;
  metaEl.style.display = meta && meta.trim() ? '' : 'none';

  const summaryHtml = linkify(summary.replace(/\(more\)\s*$/, ''));
  const summaryEl = document.getElementById('modal-summary') as HTMLElement;
  summaryEl.innerHTML = summaryHtml;

  const tagsEl = document.getElementById('modal-tags') as HTMLElement;
  tagsEl.innerHTML = '';
  tags.forEach((t) => {
    const b = document.createElement('span');
    b.className =
      'rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-300';
    b.textContent = t;
    tagsEl.appendChild(b);
  });

  const viewA = document.getElementById('modal-view-details') as HTMLAnchorElement;
  viewA.href = slug ? `/${slug}` : link;

  const img = li.querySelector('img') as HTMLImageElement | null;
  const modalImg = document.getElementById('modal-img') as HTMLImageElement;

  const slugVal = li.getAttribute('data-slug') || '';
  const thumb = li.getAttribute('data-thumbnail') || '';
  const cand: string[] = [];

  if (thumb) {
    if (/\.(webp|png|jpe?g)$/i.test(thumb)) cand.push(thumb);
    else cand.push(`${thumb}.webp`, `${thumb}.png`, `${thumb}.jpg`);
  }

  if (slugVal)
    cand.push(`/thumbs/${slugVal}.png`, `/thumbs/${slugVal}.webp`, `/thumbs/${slugVal}.jpg`);

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

  const closeBtn = document.getElementById('modal-close') as HTMLButtonElement;
  closeBtn.focus();

  focusTrapHandler = (e: FocusEvent) => {
    if (!modal.contains(e.target as Node)) {
      e.stopPropagation();
      closeBtn.focus();
    }
  };

  window.addEventListener('focusin', focusTrapHandler);
}

function closeModal() {
  const modal = document.getElementById('modal')!;
  modal.classList.add('hidden');
  (document.body as HTMLBodyElement).style.overflow = '';

  if (focusTrapHandler) window.removeEventListener('focusin', focusTrapHandler);
  if (lastFocus && (lastFocus as any).focus) (lastFocus as any).focus();
}

export default function initPublicationModal() {
  (window as any).openModalFrom = openModalFrom;

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e: KeyboardEvent) => {
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
