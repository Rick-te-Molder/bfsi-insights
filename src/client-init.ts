import initResourceModal from './features/resources/resource-modal';
import initResourceFilters from './features/resources/resource-filters';

function enhanceImages(root: Document | Element = document) {
  const imgs = Array.from(root.querySelectorAll('li.group img'));
  imgs.forEach((img) => {
    const placeholder = img.previousElementSibling;
    const onload = () => {
      img.classList.remove('opacity-0');
      if (placeholder && placeholder instanceof HTMLElement) placeholder.style.display = 'none';
    };
    const onerror = () => {
      const imgEl = img as HTMLImageElement;
      const n = (imgEl.dataset && imgEl.dataset.next) || '';
      if (n) {
        const parts = n.split('|');
        const nx = parts.shift();
        imgEl.dataset.next = parts.join('|');
        if (nx) {
          imgEl.src = nx;
          return;
        }
      }
      imgEl.style.display = 'none';
      if (placeholder && placeholder instanceof HTMLElement) placeholder.style.display = 'none';
    };
    img.addEventListener('load', onload, { once: true });
    img.addEventListener('error', onerror);
    const imgEl = img as HTMLImageElement;
    if (imgEl.complete) {
      if (imgEl.naturalWidth > 0) onload();
      else onerror();
    }
  });
}

function init() {
  initResourceModal();
  enhanceImages();
  if (document.getElementById('list')) initResourceFilters();
}

if (document.readyState !== 'loading') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
