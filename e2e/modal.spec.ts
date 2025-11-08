import { test, expect } from '@playwright/test';

async function openFirstCard(page: any) {
  const card = page.locator('li.group').first();
  await expect(card).toBeVisible();
  await card.click();
}

async function expectModalOpen(page: any) {
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
}

async function closeModal(page: any) {
  const closeBtn = page.locator('#modal-close');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }
}

test.describe('Resource modal', () => {
  test('opens from card click on index', async ({ page }) => {
    await page.goto('/');
    await openFirstCard(page);
    await expectModalOpen(page);
    await closeModal(page);
  });

  test('opens from card click on resources', async ({ page }) => {
    await page.goto('/resources');
    await openFirstCard(page);
    await expectModalOpen(page);
    await closeModal(page);
  });

  test('opens from read more button when present', async ({ page }) => {
    await page.goto('/resources');
    const readMore = page.locator('[data-open-modal]');
    if (await readMore.count()) {
      await readMore.first().click();
      await expectModalOpen(page);
      await closeModal(page);
    } else {
      test.skip(true, 'No read more buttons rendered');
    }
  });
});
