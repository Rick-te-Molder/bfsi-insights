import initResourceModal from './features/resources/resource-modal';
import initResourceFilters from './features/resources/resource-filters';

if (document.readyState !== 'loading') {
  initResourceModal();
  if (document.getElementById('list')) initResourceFilters();
} else {
  window.addEventListener('DOMContentLoaded', () => {
    initResourceModal();
    if (document.getElementById('list')) initResourceFilters();
  });
}
