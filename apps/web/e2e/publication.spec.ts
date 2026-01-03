import { test, expect } from '@playwright/test';

test.describe('Publication detail page', () => {
  test('detail page loads with content', async ({ page }) => {
    // First get a valid publication slug from the list
    await page.goto('/publications');
    const firstCard = page.locator('#list li.group').first();
    await expect(firstCard).toBeVisible();

    // Navigate to detail page via direct link if available
    const detailLink = firstCard.locator('a[href^="/publications/"]').first();
    if ((await detailLink.count()) > 0) {
      await detailLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Should have title
      await expect(page.locator('h1')).toBeVisible();

      // Should have summary content
      const article = page.locator('article, main, .content');
      await expect(article.first()).toBeVisible();
    }
  });

  test('detail page shows publication metadata', async ({ page }) => {
    await page.goto('/publications');
    const detailLink = page.locator('#list li.group a[href^="/publications/"]').first();

    if ((await detailLink.count()) > 0) {
      await detailLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Should show source name or date
      const hasMetadata =
        (await page.locator('text=/Published|Source|arXiv|McKinsey|Deloitte/i').count()) > 0;
      expect(hasMetadata).toBeTruthy();
    }
  });

  test('detail page has link to original source', async ({ page }) => {
    await page.goto('/publications');
    const detailLink = page.locator('#list li.group a[href^="/publications/"]').first();

    if ((await detailLink.count()) > 0) {
      await detailLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Should have external link to source
      const externalLinks = page.locator('a[target="_blank"], a[rel*="external"]');
      const hasExternalLink = (await externalLinks.count()) > 0;
      expect(hasExternalLink).toBeTruthy();
    }
  });

  test('detail page shows thumbnail or placeholder', async ({ page }) => {
    await page.goto('/publications');
    const detailLink = page.locator('#list li.group a[href^="/publications/"]').first();

    if ((await detailLink.count()) > 0) {
      await detailLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Should have an image (thumbnail or iframe)
      const hasVisual =
        (await page.locator('img, iframe').count()) > 0 ||
        (await page.locator('[class*="thumbnail"], [class*="preview"]').count()) > 0;
      expect(hasVisual).toBeTruthy();
    }
  });
});
