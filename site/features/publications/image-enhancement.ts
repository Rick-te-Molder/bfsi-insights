/**
 * Image enhancement for publication cards
 * Handles lazy loading fallbacks and skeleton removal
 *
 * Extracted from publications.astro for reusability
 */

export function enhanceImages(root?: Document | HTMLElement): void {
  const container = root ?? document;
  const imgs = Array.from(container.querySelectorAll('li.group img')).filter(
    (img): img is HTMLImageElement => img instanceof HTMLImageElement,
  );

  imgs.forEach((img) => {
    const placeholder = img.previousElementSibling;

    const onload = () => {
      img.classList.remove('opacity-0');
      if (placeholder && placeholder instanceof HTMLElement) {
        placeholder.style.display = 'none';
      }
    };

    const onerror = () => {
      const next = img.dataset?.next ?? '';
      if (next) {
        const parts = next.split('|');
        const nextSrc = parts.shift();
        img.dataset.next = parts.join('|');
        if (nextSrc) {
          img.src = nextSrc;
          return;
        }
      }
      img.style.display = 'none';
      if (placeholder && placeholder instanceof HTMLElement) {
        placeholder.style.display = 'none';
      }
    };

    img.addEventListener('load', onload, { once: true });
    img.addEventListener('error', onerror);

    // Handle already-loaded images
    if (img.complete) {
      if (img.naturalWidth > 0) {
        onload();
      } else {
        onerror();
      }
    }
  });
}

/**
 * Initialize image enhancement
 * Call this once on page load
 */
export function initImageEnhancement(): void {
  if (document.readyState !== 'loading') {
    enhanceImages();
  } else {
    window.addEventListener('DOMContentLoaded', () => enhanceImages());
  }
}

export default initImageEnhancement;
