import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initHierarchyCascade,
  initAllHierarchyCascades,
} from '../../../features/publications/hierarchy-cascade';

describe('hierarchy-cascade', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  function createHierarchy() {
    document.body.innerHTML = `
      <input type="checkbox" class="test-checkbox" data-level="1" data-code="L1" />
      <input type="checkbox" class="test-checkbox" data-level="2" data-code="L2A" data-parent="L1" />
      <input type="checkbox" class="test-checkbox" data-level="2" data-code="L2B" data-parent="L1" />
      <input type="checkbox" class="test-checkbox" data-level="3" data-code="L3A" data-parent="L2A" />
      <input type="checkbox" class="test-checkbox" data-level="4" data-code="L4A" data-parent="L3A" />
    `;
  }

  it('binds change handlers to checkboxes', () => {
    createHierarchy();
    initHierarchyCascade('test');

    const l1 = document.querySelector('[data-code="L1"]') as HTMLInputElement;
    const spy = vi.fn();
    l1.addEventListener('input', spy);

    l1.checked = true;
    l1.dispatchEvent(new Event('change', { bubbles: true }));

    expect(spy).toHaveBeenCalled();
  });

  it('cascades down when L1 is checked', () => {
    createHierarchy();
    initHierarchyCascade('test');

    const l1 = document.querySelector('[data-code="L1"]') as HTMLInputElement;
    l1.checked = true;
    l1.dispatchEvent(new Event('change', { bubbles: true }));

    const l2a = document.querySelector('[data-code="L2A"]') as HTMLInputElement;
    const l2b = document.querySelector('[data-code="L2B"]') as HTMLInputElement;
    const l3a = document.querySelector('[data-code="L3A"]') as HTMLInputElement;

    expect(l2a.checked).toBe(true);
    expect(l2b.checked).toBe(true);
    expect(l3a.checked).toBe(true);
  });

  it('cascades down when L2 is checked', () => {
    createHierarchy();
    initHierarchyCascade('test');

    const l2a = document.querySelector('[data-code="L2A"]') as HTMLInputElement;
    l2a.checked = true;
    l2a.dispatchEvent(new Event('change', { bubbles: true }));

    const l3a = document.querySelector('[data-code="L3A"]') as HTMLInputElement;
    expect(l3a.checked).toBe(true);
  });

  it('updates parent to indeterminate when partial children selected', () => {
    createHierarchy();
    initHierarchyCascade('test');

    const l2a = document.querySelector('[data-code="L2A"]') as HTMLInputElement;
    l2a.checked = true;
    l2a.dispatchEvent(new Event('change', { bubbles: true }));

    const l1 = document.querySelector('[data-code="L1"]') as HTMLInputElement;
    expect(l1.indeterminate).toBe(true);
  });

  it('updates parent to checked when all children selected', () => {
    createHierarchy();
    initHierarchyCascade('test');

    const l2a = document.querySelector('[data-code="L2A"]') as HTMLInputElement;
    const l2b = document.querySelector('[data-code="L2B"]') as HTMLInputElement;

    l2a.checked = true;
    l2a.dispatchEvent(new Event('change', { bubbles: true }));
    l2b.checked = true;
    l2b.dispatchEvent(new Event('change', { bubbles: true }));

    const l1 = document.querySelector('[data-code="L1"]') as HTMLInputElement;
    expect(l1.checked).toBe(true);
    expect(l1.indeterminate).toBe(false);
  });

  it('handles L4 checkbox change', () => {
    createHierarchy();
    initHierarchyCascade('test');

    const l4a = document.querySelector('[data-code="L4A"]') as HTMLInputElement;
    l4a.checked = true;
    l4a.dispatchEvent(new Event('change', { bubbles: true }));

    const l3a = document.querySelector('[data-code="L3A"]') as HTMLInputElement;
    expect(l3a.checked).toBe(true);
  });

  it('initAllHierarchyCascades initializes all filter types', () => {
    document.body.innerHTML = `
      <input type="checkbox" class="industry-checkbox" data-level="1" data-code="IND1" />
      <input type="checkbox" class="geography-checkbox" data-level="1" data-code="GEO1" />
      <input type="checkbox" class="process-checkbox" data-level="1" data-code="PROC1" />
    `;

    initAllHierarchyCascades();

    const ind = document.querySelector('.industry-checkbox') as HTMLInputElement;
    const geo = document.querySelector('.geography-checkbox') as HTMLInputElement;
    const proc = document.querySelector('.process-checkbox') as HTMLInputElement;

    ind.checked = true;
    ind.dispatchEvent(new Event('change', { bubbles: true }));

    geo.checked = true;
    geo.dispatchEvent(new Event('change', { bubbles: true }));

    proc.checked = true;
    proc.dispatchEvent(new Event('change', { bubbles: true }));

    expect(ind.checked).toBe(true);
    expect(geo.checked).toBe(true);
    expect(proc.checked).toBe(true);
  });
});
