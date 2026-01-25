/**
 * Hierarchical filter cascading selection logic
 *
 * When a parent checkbox (L1/L2) is checked/unchecked, all children cascade.
 * When a child is changed, parent shows indeterminate state if partial selection.
 *
 * Generic version that works with any hierarchical filter (industry, geography, process).
 */

function handleCheckboxChange(target: HTMLInputElement, selector: string): void {
  const level = target.dataset.level;
  const code = target.dataset.code;
  const isChecked = target.checked;

  if (level === '1') {
    cascadeDown(code!, isChecked, selector);
  } else if (level === '2') {
    cascadeDown(code!, isChecked, selector);
    updateParentState(target.dataset.parent!, '1', selector);
  } else if (level === '3') {
    cascadeDown(code!, isChecked, selector);
    updateParentState(target.dataset.parent!, '2', selector);
  } else if (level === '4') {
    updateParentState(target.dataset.parent!, '3', selector);
  }

  target.dispatchEvent(new Event('input', { bubbles: true }));
}

export function initHierarchyCascade(classPrefix: string): void {
  const selector = `.${classPrefix}-checkbox`;
  const checkboxes = document.querySelectorAll(selector);

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      handleCheckboxChange(e.target as HTMLInputElement, selector);
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

function getChildrenStats(parentCode: string, selector: string) {
  const childCheckboxes = document.querySelectorAll(`${selector}[data-parent="${parentCode}"]`);
  const children = Array.from(childCheckboxes) as HTMLInputElement[];
  return {
    checkedCount: children.filter((c) => c.checked).length,
    indeterminateCount: children.filter((c) => c.indeterminate).length,
    totalChildren: children.length,
  };
}

function applyParentCheckState(
  checkbox: HTMLInputElement,
  stats: ReturnType<typeof getChildrenStats>,
): void {
  const { checkedCount, indeterminateCount, totalChildren } = stats;
  const allChecked = checkedCount === totalChildren && indeterminateCount === 0;
  const noneChecked = checkedCount === 0 && indeterminateCount === 0;

  checkbox.checked = allChecked;
  checkbox.indeterminate = !allChecked && !noneChecked;
}

function updateParentState(parentCode: string, parentLevel: string, selector: string): void {
  const parentCheckbox = document.querySelector(
    `${selector}[data-code="${parentCode}"][data-level="${parentLevel}"]`,
  ) as HTMLInputElement;
  if (!parentCheckbox) return;

  applyParentCheckState(parentCheckbox, getChildrenStats(parentCode, selector));

  const grandparentCode = parentCheckbox.dataset.parent;
  if (grandparentCode && Number.parseInt(parentLevel) > 1) {
    updateParentState(grandparentCode, String(Number.parseInt(parentLevel) - 1), selector);
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
