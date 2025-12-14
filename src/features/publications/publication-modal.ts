import { linkify } from '../../lib/text';

let lastFocus: Element | null = null;
let focusTrapHandler: ((e: FocusEvent) => void) | null = null;

// Helper to split comma-separated data attribute, filtering empty strings
function splitAttr(val: string | undefined): string[] {
  return val ? val.split(',').filter(Boolean) : [];
}

function extractCardData(li: HTMLElement) {
  // Get arrays from data attributes, with fallbacks to single-value attributes
  const audiences = splitAttr(li.dataset.audiences);
  const geographies = splitAttr(li.dataset.geographies);
  const industries = splitAttr(li.dataset.industries);
  const topics = splitAttr(li.dataset.topics);

  return {
    title: li.dataset.title || li.querySelector('a')?.textContent?.trim() || '',
    meta: (li.querySelector('.mt-1') as HTMLElement)?.textContent?.trim() || '',
    summary:
      (li.querySelector('p.text-sm') as HTMLElement)?.textContent ||
      (li.querySelector('p') as HTMLElement)?.textContent ||
      '',
    link: (li.querySelector('a') as HTMLAnchorElement)?.href || '#',
    slug: li.dataset.slug || '',
    tags: [
      // Audiences (prefer array, fallback to single)
      ...(audiences.length ? audiences : [li.dataset.audience || li.dataset.role || '']),
      // Geographies (prefer array, fallback to single)
      ...(geographies.length ? geographies : [li.dataset.geography || '']),
      // Industries (prefer array, fallback to single)
      ...(industries.length ? industries : [li.dataset.industry || '']),
      // Topics (prefer array, fallback to single)
      ...(topics.length ? topics : [li.dataset.topic || '']),
      // Content type
      li.dataset.content_type || '',
      // Regulators
      ...splitAttr(li.dataset.regulator),
      // Regulations
      ...splitAttr(li.dataset.regulation),
      // Obligations
      ...splitAttr(li.dataset.obligation),
      // Processes
      ...splitAttr(li.dataset.process),
    ].filter(Boolean),
  };
}

function renderTags(tagsEl: HTMLElement, tags: string[]) {
  tagsEl.innerHTML = '';
  for (const t of tags) {
    const b = document.createElement('span');
    b.className =
      'rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-300';
    b.textContent = t;
    tagsEl.appendChild(b);
  }
}

function openModalFrom(li: HTMLElement) {
  const data = extractCardData(li);
  const modal = document.getElementById('modal');
  if (!modal) return;

  lastFocus = document.activeElement;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const titleEl = document.getElementById('modal-title-text');
  if (titleEl) titleEl.textContent = data.title;

  const metaEl = document.getElementById('modal-meta');
  if (metaEl) {
    metaEl.textContent = data.meta;
    metaEl.style.display = data.meta?.trim() ? '' : 'none';
  }

  const summaryEl = document.getElementById('modal-summary');
  if (summaryEl) summaryEl.innerHTML = linkify(data.summary.replace(/\(more\)\s*$/, ''));

  const tagsEl = document.getElementById('modal-tags');
  if (tagsEl) renderTags(tagsEl, data.tags);

  const viewA = document.getElementById('modal-view-details') as HTMLAnchorElement | null;
  if (viewA) viewA.href = data.slug ? `/${data.slug}` : data.link;

  const closeBtn = document.getElementById('modal-close') as HTMLButtonElement | null;
  closeBtn?.focus();

  focusTrapHandler = (e: FocusEvent) => {
    if (!modal.contains(e.target as Node)) {
      e.stopPropagation();
      closeBtn?.focus();
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
  (globalThis as any).openModalFrom = openModalFrom;

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);

  globalThis.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  });

  function bindButton(btn: HTMLElement) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const li = btn.closest('li.group') as HTMLElement;
      openModalFrom(li);
    });
  }

  document.querySelectorAll('[data-open-modal]').forEach((el) => bindButton(el as HTMLElement));

  function handleAddedNode(n: Node) {
    if (!(n instanceof Element)) return;

    if (n.matches('[data-open-modal]')) bindButton(n as HTMLElement);
    n.querySelectorAll?.('[data-open-modal]').forEach((el) => bindButton(el as HTMLElement));
  }

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach(handleAddedNode);
    }
  });

  mo.observe(document.documentElement, { subtree: true, childList: true });
}
