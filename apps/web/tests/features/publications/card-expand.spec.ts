import { describe, it, expect, beforeEach, vi } from 'vitest';
import initCardExpand from '../../../features/publications/card-expand';

describe('card-expand', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  function createCard(expanded = false) {
    const card = document.createElement('li');
    card.className = 'group';
    if (expanded) card.dataset.expanded = 'true';

    card.innerHTML = `
      <div class="card-collapsed ${expanded ? 'hidden' : ''}">Collapsed</div>
      <div class="card-expanded ${expanded ? '' : 'hidden'}">Expanded</div>
      <span class="expand-label ${expanded ? 'hidden' : ''}">Expand</span>
      <span class="collapse-label ${expanded ? '' : 'hidden'}">Collapse</span>
      <button data-expand-card aria-expanded="${expanded}">Toggle</button>
      <div class="card-collapsed-only ${expanded ? 'hidden' : ''}">Collapsed Only</div>
      <div class="card-expanded-only ${expanded ? '' : 'hidden'}">Expanded Only</div>
    `;

    return card;
  }

  it('binds click handler to expand buttons', () => {
    const card = createCard();
    document.body.appendChild(card);

    initCardExpand();

    const btn = card.querySelector('[data-expand-card]') as HTMLElement;
    expect(btn.dataset.expandBound).toBe('true');
  });

  it('expands card on button click', () => {
    const card = createCard(false);
    document.body.appendChild(card);

    initCardExpand();

    const btn = card.querySelector('[data-expand-card]') as HTMLElement;
    btn.click();

    expect(card.dataset.expanded).toBe('true');
    expect(card.querySelector('.card-collapsed')?.classList.contains('hidden')).toBe(true);
    expect(card.querySelector('.card-expanded')?.classList.contains('hidden')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses card on button click when already expanded', () => {
    const card = createCard(true);
    document.body.appendChild(card);

    initCardExpand();

    const btn = card.querySelector('[data-expand-card]') as HTMLElement;
    btn.click();

    expect(card.dataset.expanded).toBeUndefined();
    expect(card.querySelector('.card-collapsed')?.classList.contains('hidden')).toBe(false);
    expect(card.querySelector('.card-expanded')?.classList.contains('hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not double-bind buttons', () => {
    const card = createCard();
    document.body.appendChild(card);

    initCardExpand();
    initCardExpand();

    const btn = card.querySelector('[data-expand-card]') as HTMLElement;
    expect(btn.dataset.expandBound).toBe('true');
  });

  it('handles cards without required elements gracefully', () => {
    const card = document.createElement('li');
    card.className = 'group';
    card.innerHTML = '<button data-expand-card>Toggle</button>';
    document.body.appendChild(card);

    initCardExpand();

    const btn = card.querySelector('[data-expand-card]') as HTMLElement;
    expect(() => btn.click()).not.toThrow();
  });
});
