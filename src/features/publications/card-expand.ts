/**
 * Card expand/collapse functionality
 * Allows users to expand cards in-place to see more details without changing card position
 */

function toggleCard(card: HTMLElement, expand: boolean) {
  const collapsed = card.querySelector('.card-collapsed');
  const expanded = card.querySelector('.card-expanded');
  const expandLabel = card.querySelector('.expand-label');
  const collapseLabel = card.querySelector('.collapse-label');
  const expandButtons = card.querySelectorAll('[data-expand-card]');
  const collapsedOnlyElements = card.querySelectorAll('.card-collapsed-only');
  const expandedOnlyElements = card.querySelectorAll('.card-expanded-only');

  if (!collapsed || !expanded) return;

  if (expand) {
    collapsed.classList.add('hidden');
    expanded.classList.remove('hidden');
    expandLabel?.classList.add('hidden');
    collapseLabel?.classList.remove('hidden');
    card.dataset.expanded = 'true';
    // Hide collapsed-only elements (like +X more button)
    collapsedOnlyElements.forEach((el) => (el as HTMLElement).classList.add('hidden'));
    // Show expanded-only elements (extra tags)
    expandedOnlyElements.forEach((el) => (el as HTMLElement).classList.remove('hidden'));
    // Update aria-expanded on all expand buttons
    expandButtons.forEach((btn) => btn.setAttribute('aria-expanded', 'true'));
  } else {
    collapsed.classList.remove('hidden');
    expanded.classList.add('hidden');
    expandLabel?.classList.remove('hidden');
    collapseLabel?.classList.add('hidden');
    delete card.dataset.expanded;
    // Show collapsed-only elements
    collapsedOnlyElements.forEach((el) => (el as HTMLElement).classList.remove('hidden'));
    // Hide expanded-only elements
    expandedOnlyElements.forEach((el) => (el as HTMLElement).classList.add('hidden'));
    // Update aria-expanded on all expand buttons
    expandButtons.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
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
