/**
 * Hierarchical filter cascading selection logic
 *
 * When a parent checkbox (L1/L2) is checked/unchecked, all children cascade.
 * When a child is changed, parent shows indeterminate state if partial selection.
 *
 * Generic version that works with any hierarchical filter (industry, geography, process).
 */

export function initHierarchyCascade(classPrefix: string): void {
  const selector = `.${classPrefix}-checkbox`;
  const checkboxes = document.querySelectorAll(selector);

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const level = target.dataset.level;
      const code = target.dataset.code;
      const isChecked = target.checked;

      if (level === '1') {
        // L1 checked/unchecked: cascade to all descendants
        cascadeDown(code!, isChecked, selector);
      } else if (level === '2') {
        // L2 checked/unchecked: cascade to all L3s and L4s
        cascadeDown(code!, isChecked, selector);
        // Update parent L1 state
        updateParentState(target.dataset.parent!, '1', selector);
      } else if (level === '3') {
        // L3 checked/unchecked: cascade to all L4s
        cascadeDown(code!, isChecked, selector);
        // Update parent L2 and L1 states
        updateParentState(target.dataset.parent!, '2', selector);
      } else if (level === '4') {
        // L4 changed: update parent L3, L2, L1 states
        updateParentState(target.dataset.parent!, '3', selector);
      }

      // Trigger change event for filter system
      target.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}

// Cascade check state down to all descendants
function cascadeDown(parentCode: string, isChecked: boolean, selector: string): void {
  const children = document.querySelectorAll(`${selector}[data-parent="${parentCode}"]`);
  children.forEach((child) => {
    (child as HTMLInputElement).checked = isChecked;
    const childCode = (child as HTMLInputElement).dataset.code;
    if (childCode) cascadeDown(childCode, isChecked, selector);
  });
}

function updateParentState(parentCode: string, parentLevel: string, selector: string): void {
  const parentCheckbox = document.querySelector(
    `${selector}[data-code="${parentCode}"][data-level="${parentLevel}"]`,
  ) as HTMLInputElement;
  if (!parentCheckbox) return;

  const childCheckboxes = document.querySelectorAll(`${selector}[data-parent="${parentCode}"]`);
  const children = Array.from(childCheckboxes) as HTMLInputElement[];

  const checkedCount = children.filter((c) => c.checked).length;
  const indeterminateCount = children.filter((c) => c.indeterminate).length;
  const totalChildren = children.length;

  if (checkedCount === 0 && indeterminateCount === 0) {
    // No children checked or indeterminate
    parentCheckbox.checked = false;
    parentCheckbox.indeterminate = false;
  } else if (checkedCount === totalChildren && indeterminateCount === 0) {
    // All children fully checked
    parentCheckbox.checked = true;
    parentCheckbox.indeterminate = false;
  } else {
    // Some children checked or some indeterminate
    parentCheckbox.checked = false;
    parentCheckbox.indeterminate = true;
  }

  // Recursively update ancestors
  const grandparentCode = parentCheckbox.dataset.parent;
  if (grandparentCode) {
    const grandparentLevel = String(parseInt(parentLevel) - 1);
    if (parseInt(grandparentLevel) >= 1) {
      updateParentState(grandparentCode, grandparentLevel, selector);
    }
  }
}

/**
 * Initialize cascade behavior for all hierarchical filters
 */
export function initAllHierarchyCascades(): void {
  initHierarchyCascade('industry');
  initHierarchyCascade('geography');
  initHierarchyCascade('process');
}

export default initHierarchyCascade;
