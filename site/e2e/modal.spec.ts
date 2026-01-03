import { test, expect, type Page } from '@playwright/test';

async function clickPreviewButton(page: Page) {
  const previewBtn = page.locator('[data-open-modal]').first();
  await expect(previewBtn).toBeVisible();
  await previewBtn.click();
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

test.describe('Publication card navigation', () => {
  test('card click navigates to detail page on index', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('li.group').first();
    await expect(card).toBeVisible();

    // Get the detail page URL from the card link
    const cardLink = card.locator('a[data-card-link]');
    const href = await cardLink.getAttribute('href');

    // Click the card and verify navigation
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('card click navigates to detail page on publications', async ({ page }) => {
    await page.goto('/publications');
    const card = page.locator('li.group').first();
    await expect(card).toBeVisible();

    // Get the detail page URL from the card link
    const cardLink = card.locator('a[data-card-link]');
    const href = await cardLink.getAttribute('href');

    // Click the card and verify navigation
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });
});

test.describe('Publication preview modal', () => {
  test('opens from Preview button', async ({ page }) => {
    await page.goto('/publications');
    await clickPreviewButton(page);
    await expectModalOpen(page);
    await closeModal(page);
  });

  test('closes with Escape key', async ({ page }) => {
    await page.goto('/publications');
    await clickPreviewButton(page);
    await expectModalOpen(page);

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).not.toBeVisible();
  });

  test('closes by clicking overlay background', async ({ page }) => {
    await page.goto('/publications');
    await clickPreviewButton(page);
    await expectModalOpen(page);

    // Click the backdrop to close
    const backdrop = page.locator('#modal-backdrop');
    await backdrop.click({ force: true });
    await expect(page.locator('#modal')).not.toBeVisible();
  });

  test('modal shows publication content', async ({ page }) => {
    await page.goto('/publications');
    await clickPreviewButton(page);
    await expectModalOpen(page);

    // Modal should contain title
    const modalTitle = page.locator('#modal-title-text');
    await expect(modalTitle).toBeVisible();

    // Modal should contain tags
    const tagsEl = page.locator('#modal-tags');
    await expect(tagsEl).toBeVisible();

    await closeModal(page);
  });

  test('modal has More details link', async ({ page }) => {
    await page.goto('/publications');
    await clickPreviewButton(page);
    await expectModalOpen(page);

    // Should have "More details" link to the detail page
    const moreDetailsLink = page.locator('#modal-view-details');
    await expect(moreDetailsLink).toBeVisible();
    await expect(moreDetailsLink).toContainText('More details');

    await closeModal(page);
  });

  test('modal does not show "View full publication" text', async ({ page }) => {
    await page.goto('/publications');
    await clickPreviewButton(page);
    await expectModalOpen(page);

    // Verify the ambiguous label is not present
    const modal = page.locator('#modal');
    await expect(modal).not.toContainText('View full publication');

    await closeModal(page);
  });
});
