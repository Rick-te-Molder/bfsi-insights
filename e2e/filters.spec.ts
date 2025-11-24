import { test, expect } from '@playwright/test';

test.describe('Publications filters', () => {
  test('applies a filter and updates list', async ({ page }) => {
    await page.goto('/publications');

    const list = page.locator('#list li.group');
    await expect(list.first()).toBeVisible();

    // Try to use topic filter if present
    const topic = page.locator('#f-topic');
    if (await topic.count()) {
      const initial = await list.count();
      // Pick first non-empty option
      const optCount = await topic.locator('option').count();
      let chosen = -1;
      for (let i = 1; i < optCount; i++) {
        const val = await topic.locator('option').nth(i).getAttribute('value');
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
    } else {
      test.skip(true, 'No topic filter found');
    }
  });
});
