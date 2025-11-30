import { test, expect } from '@playwright/test';

test.describe('Admin pages (unauthenticated)', () => {
  test('add page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/add');

    // Should redirect to login or show login prompt
    await page.waitForTimeout(1000);
    const url = page.url();
    const hasLoginRedirect = url.includes('/login') || url.includes('/auth');
    const hasLoginForm = (await page.locator('input[type="password"]').count()) > 0;

    expect(hasLoginRedirect || hasLoginForm).toBeTruthy();
  });

  test('review page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/review');

    // Should redirect to login or show login prompt
    await page.waitForTimeout(1000);
    const url = page.url();
    const hasLoginRedirect = url.includes('/login') || url.includes('/auth');
    const hasLoginForm = (await page.locator('input[type="password"]').count()) > 0;

    expect(hasLoginRedirect || hasLoginForm).toBeTruthy();
  });
});

// Note: To test authenticated admin flows, you would need to:
// 1. Set up test user credentials in environment variables
// 2. Use page.context().addCookies() or storageState
// 3. Or use Supabase auth programmatically

/*
test.describe('Admin pages (authenticated)', () => {
  test.use({
    storageState: 'e2e/.auth/admin.json' // Would need to create this
  });

  test('add page shows URL form', async ({ page }) => {
    await page.goto('/admin/add');
    await expect(page.locator('input[type="url"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('review page shows queue items', async ({ page }) => {
    await page.goto('/admin/review');
    // Check for queue list or "no items" message
    const hasContent = 
      await page.locator('[data-queue-item]').count() > 0 ||
      await page.locator('text=/no items|empty queue/i').count() > 0;
    expect(hasContent).toBeTruthy();
  });
});
*/
