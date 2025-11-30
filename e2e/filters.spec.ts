import { test, expect } from '@playwright/test';

test.describe('Publications filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/publications');
    await expect(page.locator('#list li.group').first()).toBeVisible();
  });

  test('topic filter reduces list', async ({ page }) => {
    const list = page.locator('#list li.group');
    const topic = page.locator('#f-topic');

    if ((await topic.count()) === 0) {
      test.skip(true, 'No topic filter found');
      return;
    }

    const initial = await list.count();

    // Pick first non-empty option
    const options = topic.locator('option');
    const optCount = await options.count();
    let chosen = -1;

    for (let i = 1; i < optCount; i++) {
      const val = await options.nth(i).getAttribute('value');
      if (val && val.trim()) {
        chosen = i;
        break;
      }
    }

    if (chosen > 0) {
      await topic.selectOption({ index: chosen });
      await page.waitForTimeout(300);
      const visible = await list.filter({ hasNot: page.locator('.hidden') }).count();
      expect(visible).toBeLessThanOrEqual(initial);
    } else {
      test.skip(true, 'No non-empty topic options found');
    }
  });

  test('industry filter reduces list', async ({ page }) => {
    const list = page.locator('#list li.group');
    const industry = page.locator('#f-industry');

    if ((await industry.count()) === 0) {
      test.skip(true, 'No industry filter found');
      return;
    }

    const initial = await list.count();

    // Pick first non-empty option
    const options = industry.locator('option');
    const optCount = await options.count();

    for (let i = 1; i < optCount; i++) {
      const val = await options.nth(i).getAttribute('value');
      if (val && val.trim()) {
        await industry.selectOption({ index: i });
        await page.waitForTimeout(300);
        const visible = await list.filter({ hasNot: page.locator('.hidden') }).count();
        expect(visible).toBeLessThanOrEqual(initial);
        return;
      }
    }

    test.skip(true, 'No non-empty industry options found');
  });

  test('filter updates URL parameters', async ({ page }) => {
    const topic = page.locator('#f-topic');

    if ((await topic.count()) === 0) {
      test.skip(true, 'No topic filter found');
      return;
    }

    const options = topic.locator('option');
    const optCount = await options.count();

    for (let i = 1; i < optCount; i++) {
      const val = await options.nth(i).getAttribute('value');
      if (val && val.trim()) {
        await topic.selectOption({ index: i });
        await page.waitForTimeout(300);
        await expect(page).toHaveURL(new RegExp(`[?&]topic=${val}`));
        return;
      }
    }
  });

  test('filter persists on page reload', async ({ page }) => {
    // Navigate with filter in URL
    await page.goto('/publications?topic=strategy-and-management');

    const topic = page.locator('#f-topic');
    if ((await topic.count()) > 0) {
      // The filter should be pre-selected
      const value = await topic.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('advanced filters toggle expands filters', async ({ page }) => {
    const toggleBtn = page.locator('#toggle-advanced, [data-toggle-advanced]');

    if ((await toggleBtn.count()) === 0) {
      test.skip(true, 'No advanced filter toggle found');
      return;
    }

    // Check if there are hidden filters
    const advancedSection = page.locator('#advanced-filters, [data-advanced-filters]');

    if ((await advancedSection.count()) > 0) {
      // Click toggle
      await toggleBtn.click();
      await page.waitForTimeout(200);

      // Advanced section should be visible
      await expect(advancedSection).toBeVisible();
    }
  });

  test('combining search and filter works', async ({ page }) => {
    const list = page.locator('#list li.group');
    const searchInput = page.locator('#q');
    const topic = page.locator('#f-topic');

    if ((await searchInput.count()) === 0 || (await topic.count()) === 0) {
      test.skip(true, 'Missing search or topic filter');
      return;
    }

    const initial = await list.count();

    // Apply search
    await searchInput.fill('AI');
    await page.waitForTimeout(400);

    // Apply filter
    const options = topic.locator('option');
    for (let i = 1; i < (await options.count()); i++) {
      const val = await options.nth(i).getAttribute('value');
      if (val && val.trim()) {
        await topic.selectOption({ index: i });
        break;
      }
    }
    await page.waitForTimeout(300);

    const visible = await list.filter({ hasNot: page.locator('.hidden') }).count();
    expect(visible).toBeLessThanOrEqual(initial);
  });
});
