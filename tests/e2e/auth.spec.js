import { test, expect } from '@playwright/test';

test.describe('Authentication & Access Control E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('TC-AUTH-01: Login page renders with proper elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1.auth-title')).toContainText('Welcome Back');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText(/Login|Sign In/i);
  });

  test('TC-AUTH-02: Client-side validation blocks empty submission', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');

    // Should display validation errors
    const alert = page.locator('.auth-alert.error-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Please enter a valid email address and password');
  });

  test('TC-AUTH-03: Invalid credentials trigger 401 error message without crashing', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    const alert = page.locator('.auth-alert.error-alert');
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText('Invalid email or password');
  });

  test('TC-AUTH-04: Super Admin login succeeds and redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@kashvimlm.com');
    await page.fill('#password', 'Admin@Kashvimlm#1001');
    await page.click('button[type="submit"]');

    // Should show success notification or redirect
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15000 });

    // Verify token exists in localStorage
    const token = await page.evaluate(() => localStorage.getItem('kashvi_token'));
    expect(token).toBeTruthy();
  });

  test('TC-AUTH-05: Demo Admin login succeeds with AdminPassword@2026', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'AdminPassword@2026');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15000 });
  });

  test('TC-AUTH-06: Unauthenticated user accessing protected route is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

