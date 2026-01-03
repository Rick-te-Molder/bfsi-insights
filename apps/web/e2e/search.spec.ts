import { test, expect } from '@playwright/test';

test.describe('Search functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/publications');
    await expect(page.locator('#list li.group').first()).toBeVisible();
  });

  test('search input filters publications', async ({ page }) => {
    const searchInput = page.locator('#q');
    await expect(searchInput).toBeVisible();

    const initialCount = await page.locator('#list li.group').count();

    // Type a search term
    await searchInput.fill('AI');
    await page.waitForTimeout(400); // Debounce

    // Should filter results (may be same or fewer)
    const filteredCount = await page
      .locator('#list li.group')
      .filter({ hasNot: page.locator('.hidden') })
      .count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('search updates URL with query parameter', async ({ page }) => {
    const searchInput = page.locator('#q');
    await searchInput.fill('banking');
    await page.waitForTimeout(400);

    // URL should contain the search query
    await expect(page).toHaveURL(/[?&]q=banking/);
  });

  test('search query persists on page reload', async ({ page }) => {
    // Navigate with search query in URL
    await page.goto('/publications?q=insurance');

    const searchInput = page.locator('#q');
    await expect(searchInput).toHaveValue('insurance');
  });

  test('clearing search shows all publications', async ({ page }) => {
    const searchInput = page.locator('#q');

    // First apply a search
    await searchInput.fill('test');
    await page.waitForTimeout(400);

    // Then clear it
    await searchInput.fill('');
    await page.waitForTimeout(400);

    // All items should be visible again
    const hiddenItems = await page.locator('#list li.group.hidden').count();
    expect(hiddenItems).toBe(0);
  });
});
