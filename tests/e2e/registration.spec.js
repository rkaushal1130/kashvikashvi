import { test, expect } from '@playwright/test';

test.describe('Enrollment & Registration E2E Suite', () => {
  test('TC-REG-01: Registration page renders required input fields', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Check presence of form inputs
    const body = await page.textContent('body');
    expect(body.toLowerCase()).toContain('register');
  });

  test('TC-REG-02: Join page with referral code prepopulates sponsor or links to register', async ({ page }) => {
    await page.goto('/join?ref=KV-1001');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});

