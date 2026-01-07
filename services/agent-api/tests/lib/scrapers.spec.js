import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLaunch } = vi.hoisted(() => ({
  mockLaunch: vi.fn(),
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: mockLaunch,
  },
}));

import { scrapeWebsite } from '../../src/lib/scrapers.js';

function createPageMock() {
  const click = vi.fn();
  const loadMoreBtn = { click };

  const page = {
    addInitScript: vi.fn(),
    goto: vi.fn(),
    waitForSelector: vi.fn(() => Promise.reject(new Error('not found'))),
    $: vi.fn(async (selector) => (selector ? loadMoreBtn : null)),
    $$: vi.fn(async () => []),
    evaluate: vi.fn(async () => undefined),
  };

  return { page, click };
}

function createBrowserMock(page) {
  const context = {
    newPage: vi.fn(async () => page),
  };

  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  };

  return { browser, context };
}

describe('lib/scrapers', () => {
  beforeEach(() => {
    mockLaunch.mockReset();
  });

  it('returns empty array if scraper_config is missing', async () => {
    const res = await scrapeWebsite({});
    expect(res).toEqual([]);
  });

  it('handles pagination loadMore and returns extracted articles (limited)', async () => {
    const { page, click } = createPageMock();

    const elTarget = {
      textContent: vi.fn(async () => 'Title 1'),
      getAttribute: vi.fn(async (name) => (name === 'href' ? 'https://example.com/1' : null)),
    };

    const el = {
      $: vi.fn(async (selector) => {
        if (selector === '.title') return elTarget;
        if (selector === 'a') return elTarget;
        return null;
      }),
    };

    page.$$ = vi.fn(async () => [el, el]);

    const { browser } = createBrowserMock(page);
    mockLaunch.mockResolvedValue(browser);

    const res = await scrapeWebsite({
      scraper_config: {
        url: 'https://example.com',
        selectors: { article: '.article', title: '.title', link: 'a' },
        waitFor: '.ready',
        waitMs: 0,
        limit: 1,
        pagination: { type: 'loadMore', selector: '.load-more', maxPages: 2 },
      },
    });

    expect(page.goto).toHaveBeenCalled();
    expect(page.addInitScript).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      title: 'Title 1',
      url: 'https://example.com/1',
      date: null,
      description: null,
    });
    expect(browser.close).toHaveBeenCalled();
  });

  it('handles pagination scroll', async () => {
    const { page } = createPageMock();

    const { browser } = createBrowserMock(page);
    mockLaunch.mockResolvedValue(browser);

    page.$$ = vi.fn(async () => []);

    await scrapeWebsite({
      scraper_config: {
        url: 'https://example.com',
        selectors: { article: '.article', title: '.title', link: 'a' },
        waitMs: 0,
        pagination: { type: 'scroll', maxPages: 2 },
      },
    });

    expect(page.evaluate).toHaveBeenCalled();
  });
});
