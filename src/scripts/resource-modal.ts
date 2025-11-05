function nextSrc(el: HTMLImageElement): string | null {
  const n = el.dataset.next || '';
  if (!n) return null;
  const parts = n.split('|');
  const nx = parts.shift();
  el.dataset.next = parts.join('|');
  return nx || null;
}

function linkify(text: string): string {
  if (!text) return '';
  const urlRe = /(https?:\/\/[\w.-]+(?:\.[\w.-]+)+(?:[:#?/=][^\s]*)?)/gi;
  return text.replace(urlRe, (u) => {
    const h = u.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<a href="${h}" target="_blank" rel="noopener" class="text-sky-300 underline underline-offset-2">${h}</a>`;
  });
}

let lastFocus: Element | null = null;
let focusTrapHandler: ((e: FocusEvent) => void) | null = null;

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
    li.getAttribute('data-jurisdiction') || '',
  ].filter(Boolean);

  const m = document.getElementById('modal')!;
  lastFocus = document.activeElement;
  m.classList.remove('hidden');
  (document.body as HTMLBodyElement).style.overflow = 'hidden';

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
    // de-dup
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
  (document.body as HTMLBodyElement).style.overflow = '';
  if (focusTrapHandler) window.removeEventListener('focusin', focusTrapHandler);
  if (lastFocus && (lastFocus as any).focus) (lastFocus as any).focus();
}

export default function initResourceModal() {
  (window as any).openModalFrom = openModalFrom;
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  });

  // Delegate clicks and keys to open modal when clicking/tapping list items
  window.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest('li.group') as HTMLElement | null;
      if (!li) return;
      if ((e.target as HTMLElement).closest('a,button')) return;
      openModalFrom(li);
    });
    document.addEventListener('keydown', (e) => {
      const li = (e.target as HTMLElement).closest('li.group') as HTMLElement | null;
      if (!li) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModalFrom(li);
      }
    });
  });
}
