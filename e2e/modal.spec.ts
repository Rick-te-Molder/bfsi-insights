import { test, expect, type Page } from '@playwright/test';

async function openFirstCard(page: Page) {
  const card = page.locator('li.group').first();
  await expect(card).toBeVisible();
  await card.click();
}

async function expectModalOpen(page: Page) {
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
}

async function closeModal(page: Page) {
  const closeBtn = page.locator('#modal-close');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }
}

test.describe('Publication modal', () => {
  test('opens from card click on index', async ({ page }) => {
    await page.goto('/');
    await openFirstCard(page);
    await expectModalOpen(page);
    await closeModal(page);
  });

  test('opens from card click on publications', async ({ page }) => {
    await page.goto('/publications');
    await openFirstCard(page);
    await expectModalOpen(page);
    await closeModal(page);
  });

  test('opens from read more button when present', async ({ page }) => {
    await page.goto('/publications');
    const readMore = page.locator('[data-open-modal]');
    if (await readMore.count()) {
      await readMore.first().click();
      await expectModalOpen(page);
      await closeModal(page);
    } else {
      test.skip(true, 'No read more buttons rendered');
    }
  });

  test('closes with Escape key', async ({ page }) => {
    await page.goto('/publications');
    await openFirstCard(page);
    await expectModalOpen(page);

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).not.toBeVisible();
  });

  test('closes by clicking overlay background', async ({ page }) => {
    await page.goto('/publications');
    await openFirstCard(page);
    await expectModalOpen(page);

    // Click the overlay (outside the modal content)
    const overlay = page.locator('#modal-overlay, [data-modal-overlay]');
    if ((await overlay.count()) > 0) {
      await overlay.click({ position: { x: 10, y: 10 } });
      await expect(page.locator('#modal')).not.toBeVisible();
    }
  });

  test('modal shows publication content', async ({ page }) => {
    await page.goto('/publications');
    await openFirstCard(page);
    await expectModalOpen(page);

    // Modal should contain title
    const modalTitle = page.locator('#modal h1, #modal h2, #modal [class*="title"]');
    await expect(modalTitle.first()).toBeVisible();

    // Modal should contain summary or description
    const hasContent =
      (await page.locator('#modal p').count()) > 0 ||
      (await page.locator('#modal [class*="summary"]').count()) > 0;
    expect(hasContent).toBeTruthy();

    await closeModal(page);
  });

  test('modal has link to full article', async ({ page }) => {
    await page.goto('/publications');
    await openFirstCard(page);
    await expectModalOpen(page);

    // Should have a link to the full detail page or external source
    const links = page.locator('#modal a[href]');
    expect(await links.count()).toBeGreaterThan(0);

    await closeModal(page);
  });
});
