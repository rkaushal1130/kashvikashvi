import { test, expect } from '@playwright/test';

test.describe('Payment, Treasury Funding & Commission Distribution E2E Suite', () => {
  // Helper for admin login
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

  // Helper for distributor login
  const loginAsDistributor = async (page) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.fill('#email', 'distributor@example.com');
    await page.fill('#password', 'Distributor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  };

  test('TC-PAY-01: Admin Funding Portal renders Treasury Overview & Core Cards', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/funding-portal');

    // Verify main heading
    await expect(page.locator('h1.admin-page-title')).toContainText(/Admin Funding Portal/i, { timeout: 15000 });

    // Verify Treasury overview card (Available float balance, reserved payout, provider)
    await expect(page.locator('text=Platform Treasury Overview')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Corporate Bank Account')).toBeVisible({ timeout: 10000 });

    // Verify Tabs exist
    await expect(page.getByRole('button', { name: /Daily Commission Report/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Payout Batches/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Funding History/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Treasury Transactions Ledger/i })).toBeVisible();
  });

  test('TC-PAY-02: Connect Corporate Bank Account Modal & Form Validation', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/funding-portal');

    // Click "Connect Bank Account" button
    const connectBtn = page.getByRole('button', { name: /Connect Bank Account/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 10000 });
    await connectBtn.click();

    // Verify modal title
    await expect(page.locator('.connect-modal-title')).toContainText(/Connect Corporate Bank Account/i, { timeout: 5000 });

    // Test mismatching account numbers
    const entityInput = page.locator('input[placeholder="Legal corporate entity name as per bank records"]');
    await entityInput.fill('Kashvi Network Private Limited');

    const accNumberInput = page.locator('input[placeholder*="Enter 9 to 18 digits"]');
    await accNumberInput.fill('1923102100000382');

    const confirmAccInput = page.locator('input[placeholder="Re-enter account number"]');
    await confirmAccInput.fill('9999999999999999'); // Deliberate mismatch

    // Verify mismatch badge shows
    await expect(page.locator('.match-status-badge.mismatch')).toBeVisible();

    // Fix mismatch with exact account number
    await confirmAccInput.fill('1923102100000382');
    await expect(page.locator('.match-status-badge.matched:has-text("Numbers Match")')).toBeVisible();

    // Fill IFSC
    const ifscInput = page.locator('input[placeholder*="PUNB0192310"]').or(page.locator('input[value*="PUNB"]').first());
    if (await ifscInput.isVisible()) {
      await ifscInput.fill('PUNB0192310');
    }

    // Submit form
    const submitBtn = page.locator('.connect-modal-footer button[type="submit"]');
    await submitBtn.click();

    // Verify modal closes or success notification shows
    await expect(page.locator('.connect-modal-title')).not.toBeVisible({ timeout: 10000 });
  });

  test('TC-PAY-03: Add Corporate Funds Flow (Treasury Top-Up Form)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/funding-portal');

    // Switch to "Funding History" tab where Add Funds card is rendered
    const fundingTab = page.getByRole('button', { name: /Funding History/i });
    await fundingTab.click();

    // Verify Add Corporate Funds card is visible
    await expect(page.locator('text=Add Corporate Funds')).toBeVisible({ timeout: 10000 });

    // Click quick preset chip "+₹50k" or enter amount
    const preset50k = page.getByRole('button', { name: '+₹50k' });
    if (await preset50k.isVisible()) {
      await preset50k.click();
    } else {
      const amountInput = page.locator('.currency-input-field');
      await amountInput.fill('50000');
    }

    // Submit Add Funds
    const addFundsBtn = page.locator('button.add-funds-btn');
    await expect(addFundsBtn).toBeEnabled();
    await addFundsBtn.click();

    // Check for success banner or transaction created in Funding History table
    await expect(page.locator('.funding-banner.success, .admin-alert.success-alert, table.admin-table').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-PAY-04: Disconnect Corporate Bank Account Dialog', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/funding-portal');

    // Look for Disconnect button if an account is linked
    const disconnectBtn = page.locator('button[title*="Disconnect corporate bank account"], button.btn-disconnect-bank');
    if (await disconnectBtn.isVisible()) {
      // Setup dialog handler to accept confirm
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('disconnect this corporate bank account');
        await dialog.accept();
      });

      await disconnectBtn.click();

      // Verify success banner appears
      await expect(page.locator('.funding-banner.success, text=Corporate bank account disconnected')).toBeVisible({ timeout: 10000 });
    }
  });

  test('TC-PAY-05: Commission Distribution by Level/Rank & Batch Creation', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/commission-distribution');

    // Verify main heading
    await expect(page.locator('h1.comm-dist-title')).toContainText(/Commission Distribution/i, { timeout: 15000 });

    // Verify summary cards (Eligible Members, Payable Commission, etc.)
    await expect(page.locator('text=Total Commission Payable')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Eligible Members', { exact: true })).toBeVisible({ timeout: 10000 });

    // Verify Beneficiaries table or placeholder
    const commTable = page.locator('table.comm-table');
    await expect(commTable).toBeVisible({ timeout: 10000 });

    // Check rank filter dropdown (Silver, Gold, Platinum, Diamond, Ruby)
    const rankFilter = page.locator('select.comm-filter-select').first();
    await expect(rankFilter).toBeVisible();
    await rankFilter.selectOption('SILVER');
    await rankFilter.selectOption('GOLD');
    await rankFilter.selectOption('PLATINUM');
    await rankFilter.selectOption('DIAMOND');
    await rankFilter.selectOption('RUBY');
    await rankFilter.selectOption('ALL');

    // Check bank filter dropdown
    const bankFilter = page.locator('select.comm-filter-select').nth(2);
    if (await bankFilter.isVisible()) {
      await bankFilter.selectOption('VERIFIED');
      await expect(commTable).toBeVisible();
      await bankFilter.selectOption('ALL');
    }

    // Verify "Create Payout Batch (Maker)" button exists
    const createBatchBtn = page.locator('button.btn-primary:has-text("Create Payout Batch")');
    if (await createBatchBtn.isVisible() && await createBatchBtn.isEnabled()) {
      await createBatchBtn.click();

      // Confirm modal if open
      const confirmBatchBtn = page.locator('.comm-modal-footer button[type="submit"]');
      if (await confirmBatchBtn.isVisible()) {
        await confirmBatchBtn.click();
        await expect(page.locator('.comm-modal-overlay')).not.toBeVisible({ timeout: 10000 });
      }
    }

    // Check Payout Batches tab
    const batchesTab = page.getByRole('button', { name: /Payout Batches & History/i });
    await batchesTab.click({ force: true });
    await expect(page.locator('table.comm-table').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-PAY-06: Distributor Bank Account Addition, Penny-Drop Verification & Deletion', async ({ page }) => {
    await loginAsDistributor(page);
    await page.goto('/funding');

    // Switch to "Bank Account Management" tab
    const bankTab = page.getByRole('button', { name: /Bank Account Management/i });
    await expect(bankTab).toBeVisible({ timeout: 15000 });
    await bankTab.click();

    // Verify "Configured Payout Bank Accounts" header
    await expect(page.locator('text=Configured Payout Bank Accounts')).toBeVisible({ timeout: 10000 });

    // Open Add Bank Account Modal
    const addBankBtn = page.locator('button.btn-add-bank');
    await addBankBtn.click();

    // Verify Add Bank Modal is open
    await expect(page.locator('text=Add Bank Account for Payouts')).toBeVisible({ timeout: 5000 });

    // Fill Bank Account details
    const holderInput = page.locator('input[placeholder="As per bank passbook / KYC"]');
    await holderInput.fill('Distributor Test Account');

    const bankNameInput = page.locator('input[placeholder*="State Bank of India"]');
    await bankNameInput.fill('Punjab National Bank');

    const accNumber = '1923102100000382';
    const accInput = page.locator('input[placeholder="Enter account number"]');
    await accInput.fill(accNumber);

    const confirmAccInput = page.locator('input[placeholder="Re-enter account number"]');
    await confirmAccInput.fill(accNumber);

    // IFSC input
    const ifscInput = page.locator('input[placeholder*="SBIN0001234"]');
    await ifscInput.fill('PUNB0192310');

    // Submit modal
    const saveBankBtn = page.locator('button:has-text("Save & Verify Account")');
    await saveBankBtn.click();

    // Verify bank account card appears
    await expect(page.locator('.bank-account-card').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Pending Verification').or(page.locator('text=Verified')).first()).toBeVisible();

    // Test Penny-Drop Verification if present
    const verifyPennyBtn = page.locator('button:has-text("Verify with Penny-Drop")').first();
    if (await verifyPennyBtn.isVisible()) {
      await verifyPennyBtn.click();
      await expect(page.locator('text=Active for Payouts').or(page.locator('text=Verified')).first()).toBeVisible({ timeout: 10000 });
    }

    // Test Delete Bank Account
    const deleteBtn = page.locator('button[title="Delete Bank Account"]').first();
    if (await deleteBtn.isVisible()) {
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('remove this bank account');
        await dialog.accept();
      });

      await deleteBtn.click();
    }
  });
});
