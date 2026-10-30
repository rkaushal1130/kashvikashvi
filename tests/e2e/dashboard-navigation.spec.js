import { test, expect } from '@playwright/test';

test.describe('Dashboard & Operations Navigation E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as Super Admin
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.fill('#email', 'admin@kashvimlm.com');
    await page.fill('#password', 'Admin@Kashvimlm#1001');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15000 });
  });

  test('TC-NAV-01: Admin can access dashboard and view key elements', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();

    // Verify main body is loaded and not blank
    const bodyContent = await page.textContent('body');
    expect(bodyContent.length).toBeGreaterThan(100);
  });

  test('TC-NAV-02: Admin can navigate to Network Tree', async ({ page }) => {
    await page.goto('/network-tree');
    await expect(page.locator('h1, [role="heading"]')).toContainText(/Network Tree/i, { timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Company Root' })).toBeVisible({ timeout: 10000 });
  });

  test('TC-NAV-03: Admin can access Admin Funding Portal', async ({ page }) => {
    await page.goto('/admin/funding-portal');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
  });

  test('TC-NAV-04: Admin can access Product Management', async ({ page }) => {
    await page.goto('/manage-products');
    await expect(page.locator('h1, [role="heading"]')).toContainText(/Product & Pricing Management Center/i, { timeout: 15000 });
  });
});

