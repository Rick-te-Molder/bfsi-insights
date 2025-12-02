/**
 * Industry filter cascading selection logic
 *
 * When a parent checkbox (L1/L2) is checked/unchecked, all children cascade.
 * When a child is changed, parent shows indeterminate state if partial selection.
 *
 * Extracted from publications.astro for reusability
 */

export function initIndustryCascade(): void {
  const checkboxes = document.querySelectorAll('.industry-checkbox');

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const level = target.dataset.level;
      const code = target.dataset.code;
      const isChecked = target.checked;

      if (level === '1') {
        // L1 checked/unchecked: cascade to all L2s and L3s
        const l2Checkboxes = document.querySelectorAll(`.industry-checkbox[data-parent="${code}"]`);
        l2Checkboxes.forEach((l2) => {
          (l2 as HTMLInputElement).checked = isChecked;
          // Also cascade to L3s under this L2
          const l2Code = (l2 as HTMLInputElement).dataset.code;
          const l3Checkboxes = document.querySelectorAll(
            `.industry-checkbox[data-parent="${l2Code}"]`,
          );
          l3Checkboxes.forEach((l3) => {
            (l3 as HTMLInputElement).checked = isChecked;
          });
        });
      } else if (level === '2') {
        // L2 checked/unchecked: cascade to all L3s
        const l3Checkboxes = document.querySelectorAll(`.industry-checkbox[data-parent="${code}"]`);
        l3Checkboxes.forEach((l3) => {
          (l3 as HTMLInputElement).checked = isChecked;
        });
        // Update parent L1 state
        updateParentState(target.dataset.parent!, '1');
      } else if (level === '3') {
        // L3 changed: update parent L2 and L1 states
        updateParentState(target.dataset.parent!, '2');
      }

      // Trigger change event for filter system
      target.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  function updateParentState(parentCode: string, parentLevel: string): void {
    const parentCheckbox = document.querySelector(
      `.industry-checkbox[data-code="${parentCode}"][data-level="${parentLevel}"]`,
    ) as HTMLInputElement;
    if (!parentCheckbox) return;

    const childCheckboxes = document.querySelectorAll(
      `.industry-checkbox[data-parent="${parentCode}"]`,
    );
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

    // If this was L2, also update L1
    if (parentLevel === '2') {
      const l1Code = parentCheckbox.dataset.parent;
      if (l1Code) updateParentState(l1Code, '1');
    }
  }
}

export default initIndustryCascade;
