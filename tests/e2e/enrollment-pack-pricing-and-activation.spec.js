import { test, expect } from '@playwright/test';

test.describe('Enrollment Starter Kit Dynamic Pricing & Payment Activation E2E Suite', () => {
  const ts = Date.now().toString().slice(-6);

  const loginAsAdmin = async (page) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.fill('#email', 'admin@kashvimlm.com');
    await page.fill('#password', 'Admin@Kashvimlm#1001');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15000 });
  };

  test('TC-ENROLL-01: Starter Kit options display defined pricing and volume points', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    // Navigate to Enrollment tab
    await page.goto('/dashboard');
    const enrollNavBtn = page.locator('button[title="Enrollment"], button[aria-label="Enrollment"]');
    await expect(enrollNavBtn).toBeVisible({ timeout: 10000 });
    await enrollNavBtn.click();

    // Verify Enrollment portal loaded
    await expect(page.locator('h1.enroll-main-title')).toContainText('Enroll New Distributor or Customer', { timeout: 10000 });

    // Step 1: Fill required personal details
    await page.fill('input[placeholder="Name"]', `Test Candidate ${ts}`);
    await page.fill('input[placeholder="Email"]', `candidate_${ts}@kashvimlm.test`);
    await page.fill('input[placeholder="Mobile Number"]', '9876543210');
    await page.click('button.btn-wizard-next:has-text("Continue to Address")');

    // Step 2: Address
    await page.fill('input[placeholder="Address"]', '42 Innovation Parkway');
    await page.fill('input[placeholder*="Mumbai"]', 'Bangalore');
    await page.fill('input[placeholder="400053"]', '560001');
    await page.click('button.btn-wizard-next:has-text("Continue to Tree Placement")');

    // Step 3: Sponsor & Placement
    await expect(page.locator('h3.step-main-title:has-text("Binary Organization Placement")')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const placementCard = page.locator('.placement-radio-card');
    if (await placementCard.first().isVisible()) {
      await placementCard.first().click();
    }
    await page.click('button.btn-wizard-next:has-text("Continue")');

    // Step 4: Starter Kit selection verification
    await expect(page.locator('h3.step-main-title:has-text("Select Initial Business Activation Kit")')).toBeVisible({ timeout: 10000 });

    // Verify Associate Welcome Pack (₹1,499 / 50 BV)
    const basicPackCard = page.locator('.kit-select-card').filter({ hasText: 'Associate Welcome Pack' });
    await expect(basicPackCard).toBeVisible();
    await expect(basicPackCard).toContainText('₹1,499');
    await expect(basicPackCard).toContainText('50 BV');

    // Verify Fast-Track Pro Pack (₹2,999 / 100 BV)
    const proPackCard = page.locator('.kit-select-card').filter({ hasText: 'Fast-Track Pro Pack' });
    await expect(proPackCard).toBeVisible();
    await expect(proPackCard).toContainText('₹2,999');
    await expect(proPackCard).toContainText('100 BV');

    // Verify Elite Leadership Pack (₹4,999 / 200 BV)
    const elitePackCard = page.locator('.kit-select-card').filter({ hasText: 'Elite Leadership Pack' });
    await expect(elitePackCard).toBeVisible();
    await expect(elitePackCard).toContainText('₹4,999');
    await expect(elitePackCard).toContainText('200 BV');
  });

  test('TC-ENROLL-02: Payment checkout modal dynamically reflects selected kit price', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    await page.goto('/dashboard');
    const enrollNavBtn = page.locator('button[title="Enrollment"], button[aria-label="Enrollment"]');
    await enrollNavBtn.click();

    // Step 1
    await page.fill('input[placeholder="Name"]', `Pack Switcher ${ts}`);
    await page.fill('input[placeholder="Email"]', `switcher_${ts}@kashvimlm.test`);
    await page.fill('input[placeholder="Mobile Number"]', '9811223344');
    await page.click('button.btn-wizard-next:has-text("Continue to Address")');

    // Step 2
    await page.fill('input[placeholder="Address"]', '10 Tech Blvd');
    await page.fill('input[placeholder*="Mumbai"]', 'Mumbai');
    await page.fill('input[placeholder="400053"]', '400001');
    await page.click('button.btn-wizard-next:has-text("Continue to Tree Placement")');

    // Step 3
    await page.waitForTimeout(1000);
    const placementCard = page.locator('.placement-radio-card');
    if (await placementCard.first().isVisible()) {
      await placementCard.first().click();
    }
    await page.click('button.btn-wizard-next:has-text("Continue")');

    // Step 4: Select Elite Leadership Pack (₹4,999)
    const eliteRadio = page.locator('input[value="kit_elite"]');
    await eliteRadio.check();
    await page.click('button.btn-wizard-next:has-text("Continue to Bank & Password")');

    // Step 5: Fill password and terms agreement
    await page.fill('input[type="password"]', 'Password@123');
    const termsCheck = page.locator('.terms-checkbox-label input[type="checkbox"]');
    await termsCheck.check();

    // Trigger payment checkout modal
    const completeBtn = page.locator('button.btn-wizard-submit');
    await completeBtn.click();

    // Verify Payment Summary Box shows ₹4,999 and Elite pack details
    const payModal = page.locator('.payment-summary-box');
    await expect(payModal).toBeVisible({ timeout: 10000 });
    await expect(payModal.locator('.summary-kit-title')).toContainText('Elite Leadership Pack');
    await expect(payModal.locator('.price-num')).toContainText('4,999');
    await expect(payModal).toContainText('200 BV');
  });

  test('TC-ENROLL-03: Direct backend payment order generation returns accurate kit pricing', async ({ request }) => {
    // Test API order generation for basic pack (₹1,499)
    const basicOrderRes = await request.post('http://localhost:5001/api/v1/payments/enrollment/order', {
      data: {
        memberId: `KV-TEST-${ts}`,
        starterKitId: 'kit_basic',
        enrollmentType: 'DISTRIBUTOR',
      },
    });
    const basicData = await basicOrderRes.json();
    expect(basicOrderRes.status()).toBe(201);
    expect(basicData.success).toBe(true);
    expect(basicData.data.amount).toBe(1499);
    expect(basicData.data.amountInPaise).toBe(149900);

    // Test API order generation for pro pack (₹2,999)
    const proOrderRes = await request.post('http://localhost:5001/api/v1/payments/enrollment/order', {
      data: {
        memberId: `KV-TEST-${ts}`,
        starterKitId: 'kit_pro',
        enrollmentType: 'DISTRIBUTOR',
      },
    });
    const proData = await proOrderRes.json();
    expect(proOrderRes.status()).toBe(201);
    expect(proData.data.amount).toBe(2999);
    expect(proData.data.amountInPaise).toBe(299900);

    // Test API order generation for elite pack (₹4,999)
    const eliteOrderRes = await request.post('http://localhost:5001/api/v1/payments/enrollment/order', {
      data: {
        memberId: `KV-TEST-${ts}`,
        starterKitId: 'kit_elite',
        enrollmentType: 'DISTRIBUTOR',
      },
    });
    const eliteData = await eliteOrderRes.json();
    expect(eliteOrderRes.status()).toBe(201);
    expect(eliteData.data.amount).toBe(4999);
    expect(eliteData.data.amountInPaise).toBe(499900);
  });

  test('TC-ENROLL-04: Distributor activates only upon verified payment and receives correct BV', async ({ request }) => {
    const candidateEmail = `enroll_activate_${ts}@kashvimlm.test`;

    // 1. Submit complete enrollment without payment (Status = PENDING)
    const enrollRes = await request.post('http://localhost:5001/api/v1/enrollments/complete', {
      data: {
        fullName: `Activation Test Candidate ${ts}`,
        email: candidateEmail,
        phone: '9888777666',
        password: 'Password@123',
        sponsorId: 'KV-1001',
        placementPosition: 'RIGHT',
        enrollmentType: 'DISTRIBUTOR',
        starterKitId: 'kit_pro',
        productPackage: 'Fast-Track Pro Pack',
        price: 2999,
        address: '12 Gateway Ave',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India',
        paymentStatus: 'PENDING',
        status: 'PENDING',
      },
    });

    const enrollData = await enrollRes.json();
    expect(enrollRes.status()).toBe(201);
    expect(enrollData.success).toBe(true);

    const memberId = enrollData.data.distributor.distributorId;
    expect(enrollData.data.distributor.status).toBe('PENDING');
    expect(enrollData.data.distributor.paymentStatus).toBe('PENDING');

    // 2. Verify payment on backend to trigger activation
    const testPaymentId = `pay_test_${ts}_${Date.now()}`;
    const verifyRes = await request.post('http://localhost:5001/api/v1/enrollments/verify-payment', {
      data: {
        memberId: memberId,
        razorpayPaymentId: testPaymentId,
        razorpaySignature: `test_sig_${Date.now()}`,
        starterKitId: 'kit_pro',
        amount: 2999,
        enrollmentType: 'DISTRIBUTOR',
      },
    });

    const verifyData = await verifyRes.json();
    expect(verifyRes.status()).toBe(200);
    expect(verifyData.success).toBe(true);
    expect(verifyData.data.paymentStatus).toBe('PAID');
    expect(verifyData.data.accountStatus).toBe('ACTIVE');
    expect(verifyData.data.creditedBV).toBe(100);
  });
});
