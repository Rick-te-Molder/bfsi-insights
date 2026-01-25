/**
 * Image enhancement for publication cards
 * Handles lazy loading fallbacks and skeleton removal
 *
 * Extracted from publications.astro for reusability
 */

function hidePlaceholder(placeholder: Element | null): void {
  if (placeholder instanceof HTMLElement) {
    placeholder.style.display = 'none';
  }
}

function createOnLoadHandler(img: HTMLImageElement, placeholder: Element | null) {
  return () => {
    img.classList.remove('opacity-0');
    hidePlaceholder(placeholder);
  };
}

function createOnErrorHandler(img: HTMLImageElement, placeholder: Element | null) {
  return () => {
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
    hidePlaceholder(placeholder);
  };
}

function processImage(img: HTMLImageElement): void {
  const placeholder = img.previousElementSibling;
  const onload = createOnLoadHandler(img, placeholder);
  const onerror = createOnErrorHandler(img, placeholder);

  img.addEventListener('load', onload, { once: true });
  img.addEventListener('error', onerror);

  // Handle already-loaded images
  if (img.complete) {
    img.naturalWidth > 0 ? onload() : onerror();
  }
}

export function enhanceImages(root?: Document | HTMLElement): void {
  const container = root ?? document;
  const imgs = Array.from(container.querySelectorAll('li.group img')).filter(
    (img): img is HTMLImageElement => img instanceof HTMLImageElement,
  );

  imgs.forEach(processImage);
}

/**
 * Initialize image enhancement
 * Call this once on page load
 */
export function initImageEnhancement(): void {
  if (document.readyState === 'loading') {
    globalThis.addEventListener('DOMContentLoaded', () => enhanceImages());
  } else {
    enhanceImages();
  }
}

export default initImageEnhancement;
