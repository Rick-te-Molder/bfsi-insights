/**
 * Card expand/collapse functionality
 * Allows users to expand cards in-place to see more details without changing card position
 */

interface CardElements {
  collapsed: Element;
  expanded: Element;
  expandLabel: Element | null;
  collapseLabel: Element | null;
  expandButtons: NodeListOf<Element>;
  collapsedOnlyElements: NodeListOf<Element>;
  expandedOnlyElements: NodeListOf<Element>;
}

function getCardElements(card: HTMLElement): CardElements | null {
  const collapsed = card.querySelector('.card-collapsed');
  const expanded = card.querySelector('.card-expanded');
  if (!collapsed || !expanded) return null;

  return {
    collapsed,
    expanded,
    expandLabel: card.querySelector('.expand-label'),
    collapseLabel: card.querySelector('.collapse-label'),
    expandButtons: card.querySelectorAll('[data-expand-card]'),
    collapsedOnlyElements: card.querySelectorAll('.card-collapsed-only'),
    expandedOnlyElements: card.querySelectorAll('.card-expanded-only'),
  };
}

function applyExpandedState(card: HTMLElement, els: CardElements): void {
  els.collapsed.classList.add('hidden');
  els.expanded.classList.remove('hidden');
  els.expandLabel?.classList.add('hidden');
  els.collapseLabel?.classList.remove('hidden');
  card.dataset.expanded = 'true';
  els.collapsedOnlyElements.forEach((el) => (el as HTMLElement).classList.add('hidden'));
  els.expandedOnlyElements.forEach((el) => (el as HTMLElement).classList.remove('hidden'));
  els.expandButtons.forEach((btn) => btn.setAttribute('aria-expanded', 'true'));
}

function applyCollapsedState(card: HTMLElement, els: CardElements): void {
  els.collapsed.classList.remove('hidden');
  els.expanded.classList.add('hidden');
  els.expandLabel?.classList.remove('hidden');
  els.collapseLabel?.classList.add('hidden');
  delete card.dataset.expanded;
  els.collapsedOnlyElements.forEach((el) => (el as HTMLElement).classList.remove('hidden'));
  els.expandedOnlyElements.forEach((el) => (el as HTMLElement).classList.add('hidden'));
  els.expandButtons.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
}

function toggleCard(card: HTMLElement, expand: boolean) {
  const els = getCardElements(card);
  if (!els) return;

  if (expand) {
    applyExpandedState(card, els);
  } else {
    applyCollapsedState(card, els);
  }
}

function bindExpandButton(btn: HTMLElement) {
  // Prevent duplicate bindings
  if (btn.dataset.expandBound === 'true') return;
  btn.dataset.expandBound = 'true';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const card = btn.closest('li.group') as HTMLElement;
    if (!card) return;

    const isExpanded = 'expanded' in card.dataset;
    toggleCard(card, !isExpanded);
  });
}

export default function initCardExpand() {
  // Bind all existing expand buttons
  document.querySelectorAll('[data-expand-card]').forEach((el) => {
    bindExpandButton(el as HTMLElement);
  });

  // Watch for dynamically added cards (infinite scroll, etc.)
  const mo = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;

        if (node.matches('[data-expand-card]')) {
          bindExpandButton(node as HTMLElement);
        }
        node.querySelectorAll?.('[data-expand-card]').forEach((el) => {
          bindExpandButton(el as HTMLElement);
        });
      });
    }
  });

  mo.observe(document.documentElement, { subtree: true, childList: true });
}
