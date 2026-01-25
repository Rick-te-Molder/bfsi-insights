import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enhanceImages,
  initImageEnhancement,
} from '../../../features/publications/image-enhancement';

describe('image-enhancement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  function createCardWithImage(complete = false, naturalWidth = 100) {
    const card = document.createElement('li');
    card.className = 'group';

    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';

    const img = document.createElement('img');
    img.className = 'opacity-0';
    img.src = 'test.jpg';
    img.dataset.next = 'fallback1.jpg|fallback2.jpg';

    Object.defineProperty(img, 'complete', { value: complete, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });

    card.appendChild(placeholder);
    card.appendChild(img);
    document.body.appendChild(card);

    return { card, img, placeholder };
  }

  it('removes opacity-0 class on image load', () => {
    const { img } = createCardWithImage(false);

    enhanceImages();

    img.dispatchEvent(new Event('load'));

    expect(img.classList.contains('opacity-0')).toBe(false);
  });

  it('hides placeholder on image load', () => {
    const { img, placeholder } = createCardWithImage(false);

    enhanceImages();

    img.dispatchEvent(new Event('load'));

    expect((placeholder as HTMLElement).style.display).toBe('none');
  });

  it('tries next fallback on error', () => {
    const { img } = createCardWithImage(false);

    enhanceImages();

    img.dispatchEvent(new Event('error'));

    expect(img.src).toContain('fallback1.jpg');
    expect(img.dataset.next).toBe('fallback2.jpg');
  });

  it('hides image when all fallbacks exhausted', () => {
    const { img, placeholder } = createCardWithImage(false);
    img.dataset.next = '';

    enhanceImages();

    img.dispatchEvent(new Event('error'));

    expect(img.style.display).toBe('none');
    expect((placeholder as HTMLElement).style.display).toBe('none');
  });

  it('handles already-loaded images with naturalWidth > 0', () => {
    const { img, placeholder } = createCardWithImage(true, 100);

    enhanceImages();

    expect(img.classList.contains('opacity-0')).toBe(false);
    expect((placeholder as HTMLElement).style.display).toBe('none');
  });

  it('handles already-loaded images with naturalWidth = 0 (error)', () => {
    const { img } = createCardWithImage(true, 0);

    enhanceImages();

    expect(img.src).toContain('fallback1.jpg');
  });

  it('initImageEnhancement calls enhanceImages when DOM ready', () => {
    createCardWithImage(true, 100);

    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });

    initImageEnhancement();

    const img = document.querySelector('img') as HTMLImageElement;
    expect(img.classList.contains('opacity-0')).toBe(false);
  });

  it('initImageEnhancement waits for DOMContentLoaded when loading', () => {
    createCardWithImage(false);

    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });

    const addEventListenerSpy = vi.spyOn(globalThis, 'addEventListener');

    initImageEnhancement();

    expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
  });
});
