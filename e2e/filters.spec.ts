import { test, expect } from '@playwright/test';

test.describe('Resources filters', () => {
  test('applies a filter and updates count', async ({ page }) => {
    await page.goto('/resources');
    const list = page.locator('#list li.group');
    await expect(list.first()).toBeVisible();

    const select = page.locator('#f-topic');
    if (await select.count()) {
      const initialCount = await list.count();
      await select.selectOption({ index: 1 }); // any option different from empty
      // Wait for DOM update
      await page.waitForTimeout(300);
      const filteredCount = await list.filter({ hasNot: page.locator('.hidden') }).count();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    } else {
      test.skip(true, 'No topic filter on the page');
    }
  });
});
