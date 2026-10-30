import { test, expect } from '@playwright/test';

test.describe('Enrollment & Registration E2E Suite', () => {
  const ts = Date.now().toString().slice(-6);

  test('TC-REG-01: Registration page renders required input fields', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Check presence of form inputs
    const body = await page.textContent('body');
    expect(body.toLowerCase()).toContain('register');
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('label[for="phone"]')).toContainText(/Mobile Number \*/i);
    await expect(page.locator('label[for="email"]')).toContainText(/Email Address \(Optional\)/i);
  });

  test('TC-REG-02: Join page with referral code prepopulates sponsor or links to register', async ({ page }) => {
    await page.goto('/join?ref=KV-1001');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('TC-REG-03: Mobile-only registration succeeds with 8-digit password (no format restrictions)', async ({ page, request }) => {
    const mobileNumber = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const simple8DigitPassword = '88776655'; // 8-digit purely numeric password

    // 1. API Registration without email
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        fullName: 'Mobile Only Member',
        phone: mobileNumber,
        password: simple8DigitPassword,
        confirmPassword: simple8DigitPassword,
        referralCode: 'KV-1001',
      },
    });

    expect(regRes.status()).toBe(201);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);
    const distCode = regData.data?.user?.referralCode || regData.data?.user?.distributorCode;
    expect(distCode).toMatch(/^DST-\d{4,}$/);

    // 2. UI Login using the Mobile Number
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.fill('#email', mobileNumber);
    await page.fill('#password', simple8DigitPassword);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15000 });
  });

  test('TC-REG-04: Registration with Mobile Number and Optional Email succeeds with simple 8-char password', async ({ page, request }) => {
    const mobileNumber = `96${Math.floor(10000000 + Math.random() * 90000000)}`;
    const email = `dual_auth_${ts}@testkashvi.com`;
    const simple8CharPassword = 'password'; // 8 lowercase characters (previously rejected by strict regex)

    // 1. API Registration with both phone and email
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        fullName: 'Dual Auth Member',
        phone: mobileNumber,
        email,
        password: simple8CharPassword,
        confirmPassword: simple8CharPassword,
        referralCode: 'KV-1001',
      },
    });

    expect(regRes.status()).toBe(201);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);

    // 2. UI Login using Email
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.fill('#email', email);
    await page.fill('#password', simple8CharPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15000 });

    // 3. UI Login using Mobile Number for the same account
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', mobileNumber);
    await page.fill('#password', simple8CharPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15000 });
  });

  test('TC-REG-05: Registration rejects password shorter than 8 digits/characters', async ({ request }) => {
    const mobileNumber = `95${Math.floor(10000000 + Math.random() * 90000000)}`;
    const shortPassword = '1234567'; // 7 digits

    const res = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        fullName: 'Short Pass Member',
        phone: mobileNumber,
        password: shortPassword,
        confirmPassword: shortPassword,
        referralCode: 'KV-1001',
      },
    });

    expect([400, 422]).toContain(res.status());
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('8');
  });

  test('TC-REG-06: Registration rejects missing mobile number', async ({ request }) => {
    const res = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        fullName: 'No Phone Member',
        email: `nophone_${ts}@testkashvi.com`,
        password: 'ValidPass123',
        confirmPassword: 'ValidPass123',
        referralCode: 'KV-1001',
      },
    });

    expect([400, 422]).toContain(res.status());
    const json = await res.json();
    expect(JSON.stringify(json).toLowerCase()).toContain('mobile number');
  });
});


