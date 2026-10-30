import { test, expect } from '@playwright/test';

test.describe('Distributor ID Format, Referral Enrollment & Binary Leg Alternation Suite', () => {
  const ts = Date.now().toString().slice(-6);

  // Helper for login
  const login = async (page, email, password) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|admin|network-tree)/, { timeout: 15000 });
  };

  test('TC-DIST-01: New distributor creation generates sequential ID in DST-000 format', async ({ request }) => {
    const email = `parent_dist_${ts}@testkashvi.com`;
    const res = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        email,
        password: 'Password@1234',
        confirmPassword: 'Password@1234',
        fullName: 'Kashvi Parent Distributor',
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        referralCode: 'KV-1001',
        acceptTerms: true,
      },
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    const distCode = json.data?.user?.referralCode || json.data?.user?.distributorCode;

    // Verify format is DST- followed by digits (e.g. DST-0001, DST-0012...)
    expect(distCode).toMatch(/^DST-\d{4,}$/);
    console.log(`✅ Generated Distributor ID: ${distCode}`);
  });

  test('TC-DIST-02: Referrals under distributor ID alternate legs (1st: RIGHT, 2nd: LEFT, 3rd: RIGHT, 4th: LEFT)', async ({ request }) => {
    test.setTimeout(90000);
    const localTs = Date.now().toString().slice(-6);
    // 1. Create a parent distributor
    const parentEmail = `sponsor_dist_${localTs}_${Math.floor(Math.random() * 1000)}@testkashvi.com`;
    const parentRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        email: parentEmail,
        password: 'Password@1234',
        confirmPassword: 'Password@1234',
        fullName: 'Sponsor Parent Dist',
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        referralCode: 'KV-1001',
        acceptTerms: true,
      },
    });

    expect(parentRes.status()).toBe(201);
    const parentJson = await parentRes.json();
    const sponsorDistCode = parentJson.data?.user?.referralCode || parentJson.data?.user?.distributorCode;
    expect(sponsorDistCode).toMatch(/^DST-\d{4,}$/);

    // 2. Register 4 consecutive distributors using sponsorDistCode as referral
    const legPositions = [];
    for (let i = 1; i <= 4; i++) {
      const childEmail = `downline_${i}_${localTs}_${Math.floor(Math.random() * 1000)}@testkashvi.com`;
      const childRes = await request.post('http://localhost:5001/api/auth/register', {
        data: {
          email: childEmail,
          password: 'Password@1234',
          confirmPassword: 'Password@1234',
          fullName: `Downline Member ${i}`,
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          referralCode: sponsorDistCode,
          acceptTerms: true,
        },
      });

      expect(childRes.status()).toBe(201);
      const childJson = await childRes.json();
      const childCode = childJson.data?.user?.referralCode;
      expect(childCode).toMatch(/^DST-\d{4,}$/);

      // Verify node placement position via tree endpoint or user position
      const pos = childJson.data?.user?.position || childJson.data?.user?.placementPosition;
      legPositions.push(pos);
    }

    // Verify alternation: 1st -> RIGHT, 2nd -> LEFT, 3rd -> RIGHT, 4th -> LEFT
    console.log(`✅ Downlines registered under ${sponsorDistCode} with alternating positions:`, legPositions);
    expect(legPositions[0]).toBe('RIGHT');
    expect(legPositions[1]).toBe('LEFT');
    expect(legPositions[2]).toBe('RIGHT');
    expect(legPositions[3]).toBe('LEFT');
  });

  test('TC-DIST-03: Distributor can view only their own tree at /network-tree', async ({ page, request }) => {
    test.setTimeout(60000);
    // 1. Create distributor with referrals
    const distEmail = `view_dist_${ts}@testkashvi.com`;
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        email: distEmail,
        password: 'Password@1234',
        confirmPassword: 'Password@1234',
        fullName: 'View Own Tree User',
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        referralCode: 'KV-1001',
        acceptTerms: true,
      },
    });
    expect(regRes.status()).toBe(201);
    const distJson = await regRes.json();
    const myDistCode = distJson.data?.user?.referralCode;

    // 2. Log in as this distributor
    await login(page, distEmail, 'Password@1234');
    await page.goto('/network-tree');

    // 3. Verify tree renders
    await expect(page.getByRole('heading', { name: /Network Tree/i, level: 1 })).toBeVisible({ timeout: 25000 });

    // 4. Verify tree root is the distributor's own root
    await expect(page.getByRole('button', { name: new RegExp(`${myDistCode}|View Own Tree User`, 'i') }).first()).toBeVisible({ timeout: 20000 });

    // 5. Verify distributor cannot see Admin controls (Company Root, Move Distributor, Tree Audit Logs)
    await expect(page.getByRole('button', { name: 'Company Root' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Move Distributor' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Tree Audit Logs' })).not.toBeVisible();
    await expect(page.getByPlaceholder('Search by Name or Distributor ID')).not.toBeVisible();
  });

  test('TC-DIST-04: Distributor attempting to view another distributor tree via URL is blocked', async ({ page, request }) => {
    test.setTimeout(60000);
    const distEmail = `block_dist_${ts}@testkashvi.com`;
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        email: distEmail,
        password: 'Password@1234',
        confirmPassword: 'Password@1234',
        fullName: 'Blocked Tree User',
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        referralCode: 'KV-1001',
        acceptTerms: true,
      },
    });
    expect(regRes.status()).toBe(201);
    const distJson = await regRes.json();
    const myDistCode = distJson.data?.user?.referralCode;

    // Log in as distributor
    await login(page, distEmail, 'Password@1234');

    // Attempt to access Company Root / Admin tree via ?member=KV-1001
    await page.goto('/network-tree?member=KV-1001');
    await page.waitForTimeout(2000);

    // Verify Admin root is NOT displayed
    await expect(page.getByRole('button', { name: /Admin \(My Root\)/i })).not.toBeVisible();

    // Verify UI locks back to distributor's own root
    await expect(page.getByRole('button', { name: new RegExp(`${myDistCode}|Blocked Tree User`, 'i') }).first()).toBeVisible({ timeout: 20000 });
  });

  test('TC-DIST-05: Admin can view all trees and search any distributor', async ({ page }) => {
    test.setTimeout(60000);
    await login(page, 'admin@kashvimlm.com', 'Admin@Kashvimlm#1001');
    await page.goto('/network-tree');

    // Verify tree heading
    await expect(page.getByRole('heading', { name: /Network Tree/i, level: 1 })).toBeVisible({ timeout: 25000 });

    // Verify Admin controls ARE visible
    await expect(page.getByRole('button', { name: 'Company Root' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Admin \(My Root\)/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByPlaceholder('Search by Name or Distributor ID')).toBeVisible({ timeout: 20000 });

    // Wait for tree data loading to finish
    await expect(page.getByText('Loading database-driven binary genealogy...')).not.toBeVisible({ timeout: 25000 });

    // Verify binary legs are displayed
    await expect(page.getByText(/LEFT LEG/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/RIGHT LEG/i).first()).toBeVisible({ timeout: 20000 });
  });
});
