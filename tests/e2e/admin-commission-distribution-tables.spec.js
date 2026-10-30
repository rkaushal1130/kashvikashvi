import { test, expect } from '@playwright/test';

test.describe('Admin Commission Distribution & Funding Portal Distributor Tables E2E Suite', () => {
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

  test('TC-DIST-COMM-01: Admin Funding Portal table lists distributed commissions for distributors (not employees)', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    // 1. Navigate to Admin Funding Portal
    await page.goto('/admin/funding-portal');
    await expect(page.locator('h1, .admin-page-title')).toContainText('Admin Funding Portal', { timeout: 15000 });

    // 2. Verify summary stat card says "Total Distributors" (not "Total Employees")
    await expect(page.locator('.summary-stat-label:has-text("Total Distributors")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.summary-stat-label:has-text("Total Employees")')).toHaveCount(0);

    // 3. Tab 0: Daily Commission Report
    const commTab = page.locator('button.funding-tab-btn:has-text("Daily Commission Report")');
    await expect(commTab).toBeVisible({ timeout: 10000 });
    await commTab.click();

    // 4. Verify table headers specify DISTRIBUTOR ID and DISTRIBUTOR NAME (not EMPLOYEE ID / EMPLOYEE NAME)
    const reportTable = page.locator('.report-table-custom');
    await expect(reportTable).toBeVisible({ timeout: 10000 });

    const distIdHeader = reportTable.locator('thead th:has-text("Distributor ID")');
    const distNameHeader = reportTable.locator('thead th:has-text("Distributor Name")');
    await expect(distIdHeader).toBeVisible();
    await expect(distNameHeader).toBeVisible();

    // Ensure EMPLOYEE ID / EMPLOYEE NAME headers no longer exist
    await expect(reportTable.locator('thead th:has-text("Employee ID")')).toHaveCount(0);
    await expect(reportTable.locator('thead th:has-text("Employee Name")')).toHaveCount(0);

    // 5. Verify distributed commission rows are populated in the table
    const distRow = reportTable.locator('tbody tr').filter({ hasText: /DST-\d+|KV-\d+/ });
    await expect(distRow.first()).toBeVisible({ timeout: 15000 });
    const count = await distRow.count();
    expect(count).toBeGreaterThan(0);

    // 6. Switch to Payout Batches tab and verify header says Total Distributors
    const batchesTab = page.locator('button.funding-tab-btn:has-text("Payout Batches")');
    await batchesTab.click();
    const batchesTable = page.locator('.admin-table');
    await expect(batchesTable).toBeVisible({ timeout: 10000 });
    await expect(batchesTable.locator('thead th:has-text("Total Distributors")')).toBeVisible();
    await expect(batchesTable.locator('thead th:has-text("Total Employees")')).toHaveCount(0);
  });

  test('TC-DIST-COMM-02: Commission Distribution Page table shows Distributor ID, Distributor Name, and distributor counts', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    // 1. Navigate to Commission Distribution Page
    await page.goto('/admin/commission-distribution');
    await expect(page.locator('h1, .comm-dist-title')).toContainText('Commission Distribution', { timeout: 15000 });

    // 2. Verify Table Columns say Distributor ID and Distributor Name
    const commTable = page.locator('.comm-table');
    await expect(commTable).toBeVisible({ timeout: 10000 });

    const distIdHeader = commTable.locator('thead th:has-text("Distributor ID")');
    const distNameHeader = commTable.locator('thead th:has-text("Distributor Name")');
    await expect(distIdHeader).toBeVisible();
    await expect(distNameHeader).toBeVisible();

    await expect(commTable.locator('thead th:has-text("Member ID")')).toHaveCount(0);
    await expect(commTable.locator('thead th:has-text("Employee ID")')).toHaveCount(0);

    // 3. Verify distributor beneficiaries are listed
    const rows = commTable.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // 4. Switch to Payout Batches tab in Commission Distribution Page
    const batchesTab = page.locator('.comm-nav-tab:has-text("Payout Batches")');
    if (await batchesTab.isVisible()) {
      await batchesTab.click();
      const batchTable = page.locator('.comm-table');
      await expect(batchTable.locator('thead th:has-text("Distributors")')).toBeVisible();
      await expect(batchTable.locator('thead th:has-text("Beneficiaries")')).toHaveCount(0);
      const batchText = await batchTable.textContent();
      expect(batchText).toContain('distributors');
    }
  });

  test('TC-DIST-COMM-03: Commission Distribution Progress Bar renders with visual track and metrics', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    // 1. Check Progress Bar on Admin Funding Portal (/admin/funding-portal)
    await page.goto('/admin/funding-portal');
    await expect(page.locator('h1, .admin-page-title')).toContainText('Admin Funding Portal', { timeout: 15000 });

    const heroCard = page.locator('.distribute-hero-card');
    await expect(heroCard).toBeVisible({ timeout: 10000 });

    const progressSection = heroCard.locator('.distribute-progress-section');
    await expect(progressSection).toBeVisible({ timeout: 10000 });

    // Verify progress title & label
    await expect(progressSection.locator('.distribute-progress-label')).toContainText('Distribution Progress');

    // Verify progress track exists
    const progressTrack = progressSection.locator('.distribute-progress-track');
    await expect(progressTrack).toBeVisible();

    // Verify amounts & distributor metrics rendered
    const metrics = await progressSection.textContent();
    expect(metrics).toMatch(/₹[\d,]+(\.\d{2})?/);
    expect(metrics).toMatch(/\d+ distributors|\d+ \/ \d+ distributors/);

    // 2. Check Progress Bar on Commission Distribution Page (/admin/commission-distribution)
    await page.goto('/admin/commission-distribution');
    await expect(page.locator('h1, .comm-dist-title')).toContainText('Commission Distribution', { timeout: 15000 });

    const commProgressCard = page.locator('.comm-progress-card');
    await expect(commProgressCard).toBeVisible({ timeout: 10000 });
    await expect(commProgressCard.locator('.comm-progress-title')).toContainText('Commission Distribution Progress');
    await expect(commProgressCard.locator('.comm-progress-bar-track')).toBeVisible();

    const commMetrics = await commProgressCard.textContent();
    expect(commMetrics).toMatch(/% Distributed/);
    expect(commMetrics).toMatch(/Paid \/ Disbursed/);
    expect(commMetrics).toMatch(/distributors/);
  });

  test('TC-DIST-COMM-04: Eligible members table renders 5 distributors and Distribute All button completes 100% payout', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    await page.goto('/admin/commission-distribution');
    await expect(page.locator('h1, .comm-dist-title')).toContainText('Commission Distribution', { timeout: 15000 });

    // 1. Verify summary card & tab badge show 5 eligible members
    const eligibleTabBadge = page.locator('.comm-tab-btn.active .comm-tab-badge');
    await expect(eligibleTabBadge).toHaveText('5', { timeout: 10000 });

    // 2. Verify all 5 distributor rows are visible in the table
    const commTable = page.locator('.comm-table');
    await expect(commTable).toBeVisible({ timeout: 10000 });
    const rows = commTable.locator('tbody tr');
    await expect(rows).toHaveCount(5);

    // Verify distributor IDs and names
    await expect(commTable).toContainText('DST-10001');
    await expect(commTable).toContainText('Vikram Malhotra');
    await expect(commTable).toContainText('Anita Roy');
    await expect(commTable).toContainText('Rahul Kaushal');

    // 3. Verify total disbursable verified amount shows ₹3,92,500.00
    const footerText = await page.locator('.comm-action-footer').textContent();
    expect(footerText).toContain('3,92,500.00');

    // 4. Verify "Distribute All Eligible Commissions" button is visible in header
    const distributeBtn = page.locator('.comm-distribute-all-btn').first();
    await expect(distributeBtn).toBeVisible({ timeout: 10000 });
    await expect(distributeBtn).toContainText('Distribute All Eligible Commissions');

    // 5. Click the button to disburse
    await distributeBtn.click();

    // 6. Verify success banner and progress reaches 100%
    await expect(page.locator('.security-box.success')).toBeVisible({ timeout: 15000 });
    const progressPill = page.locator('.comm-progress-pill');
    await expect(progressPill).toHaveText('100% Distributed');
  });
});
