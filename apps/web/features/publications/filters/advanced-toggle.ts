/**
 * Advanced Filters Toggle
 *
 * Handles the expand/collapse of advanced filters section.
 */

import { saveAdvancedFiltersState, getAdvancedFiltersState } from './storage';

/** Update toggle button text */
function updateButtonText(button: HTMLElement, isExpanded: boolean) {
  const buttonText = button.querySelector('span');
  if (buttonText) {
    buttonText.textContent = isExpanded ? 'Fewer filters' : 'More filters';
  }
}

/** Set expanded state on UI elements */
function setExpandedState(
  button: HTMLElement,
  filters: HTMLElement,
  icon: HTMLElement,
  isExpanded: boolean,
) {
  if (isExpanded) {
    filters.classList.remove('hidden');
    icon.classList.add('rotate-90');
  } else {
    filters.classList.add('hidden');
    icon.classList.remove('rotate-90');
  }
  button.setAttribute('aria-expanded', String(isExpanded));
  updateButtonText(button, isExpanded);
}

/** Setup advanced filters toggle */
export function setupAdvancedFiltersToggle() {
  const toggleBtn = document.getElementById('toggle-advanced-filters');
  const advancedFilters = document.getElementById('advanced-filters');
  const advancedIcon = document.getElementById('advanced-filters-icon');

  if (!toggleBtn || !advancedFilters || !advancedIcon) return;

  // Restore saved state
  const savedState = getAdvancedFiltersState();
  if (savedState) {
    setExpandedState(toggleBtn, advancedFilters, advancedIcon, true);
  }

  // Toggle handler
  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    const newState = !isExpanded;
    setExpandedState(toggleBtn, advancedFilters, advancedIcon, newState);
    saveAdvancedFiltersState(newState);
  });
}
