import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page loads and has content', async ({ page }) => {
    await page.goto('/');

    // Should have header with logo/title
    await expect(page.locator('header')).toBeVisible();

    // Should have navigation links
    await expect(page.locator('a[href="/publications"]')).toBeVisible();
  });

  test('publications link works from home', async ({ page }) => {
    await page.goto('/');

    await page.click('a[href="/publications"]');
    await expect(page).toHaveURL('/publications');
    await expect(page.locator('#list')).toBeVisible();
  });

  test('home link works from publications', async ({ page }) => {
    await page.goto('/publications');

    // Click home link (could be logo or "Home" text)
    const homeLink = page.locator('a[href="/"]').first();
    await homeLink.click();
    await expect(page).toHaveURL('/');
  });

  test('breadcrumbs show on publication detail page', async ({ page }) => {
    await page.goto('/publications');

    // Get first publication link
    const firstCard = page.locator('#list li.group').first();
    await expect(firstCard).toBeVisible();

    // Find the link to the detail page
    const detailLink = firstCard.locator('a[href^="/publications/"]').first();
    if ((await detailLink.count()) > 0) {
      const href = await detailLink.getAttribute('href');
      await page.goto(href!);

      // Should have breadcrumb navigation
      await expect(page.locator('text=Publications')).toBeVisible();
    }
  });

  test('404 page shows for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');
    expect(response?.status()).toBe(404);
  });
});
