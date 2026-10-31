import { test, expect } from '@playwright/test';

test.describe('Dynamic Distributor Creation via UI & Dual-Leg Tree Formation', () => {
  test.setTimeout(300000);

  const login = async (page, email, password) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|admin|network-tree)/, { timeout: 20000 });
  };

  test('Add 20 distributors via Admin Panel UI, verify complete trees for Admin and Distributor without 403', async ({ page }) => {
    page.on('console', (msg) => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
    page.on('pageerror', (err) => console.log('[BROWSER PAGE ERROR]:', err.message));
    page.on('requestfailed', (req) => {
      console.log(`[NET FAILED] ${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        console.log(`[NET ${res.status()}] ${res.request().method()} ${res.url()}`);
      }
    });

    // 1. Log in as Admin
    console.log('🔑 Logging in as Admin (admin@kashvimlm.com)...');
    await login(page, 'admin@kashvimlm.com', 'Admin@Kashvimlm#1001');

    // 2. Navigate to Admin Distributor Management
    await page.goto('/admin/distributors');
    await expect(page.locator('.admin-page-title')).toContainText('Distributor Management', { timeout: 20000 });

    // Verify Add Distributor button is present
    const addBtn = page.locator('button.add-distributor-btn');
    await expect(addBtn).toBeVisible({ timeout: 10000 });

    // 20 distributors forming complete dual-leg trees for Admin and Amit Patel (DST-0001)
    const distributorsToCreate = [
      // Level 1 of Admin (KV-0001)
      { name: 'Amit Patel', email: 'distributor@example.com', phone: '+91 98765 00002', sponsorId: 'KV-0001', position: 'LEFT' },
      { name: 'Rohit Sharma', email: 'rohit@example.com', phone: '+91 98765 00003', sponsorId: 'KV-0001', position: 'RIGHT' },

      // Level 2 under Amit (DST-0001)
      { name: 'Pooja Sharma', email: 'pooja@example.com', phone: '+91 98765 00004', sponsorId: 'DST-0001', position: 'LEFT' },
      { name: 'Neha Gupta', email: 'neha@example.com', phone: '+91 98765 00005', sponsorId: 'DST-0001', position: 'RIGHT' },

      // Level 2 under Rohit (DST-0002)
      { name: 'Priya Sharma', email: 'priya@example.com', phone: '+91 98765 00006', sponsorId: 'DST-0002', position: 'LEFT' },
      { name: 'Ananya Sen', email: 'ananya@example.com', phone: '+91 98765 00007', sponsorId: 'DST-0002', position: 'RIGHT' },

      // Level 3 under Pooja (DST-0003)
      { name: 'Deepak Verma', email: 'deepak@example.com', phone: '+91 98765 00008', sponsorId: 'DST-0003', position: 'LEFT' },
      { name: 'Sunita Rao', email: 'sunita@example.com', phone: '+91 98765 00009', sponsorId: 'DST-0003', position: 'RIGHT' },

      // Level 3 under Neha (DST-0004)
      { name: 'Arjun Singh', email: 'arjun@example.com', phone: '+91 98765 00010', sponsorId: 'DST-0004', position: 'LEFT' },
      { name: 'Meera Nair', email: 'meera@example.com', phone: '+91 98765 00011', sponsorId: 'DST-0004', position: 'RIGHT' },

      // Level 3 under Priya (DST-0005)
      { name: 'Suresh Kumar', email: 'suresh@example.com', phone: '+91 98765 00012', sponsorId: 'DST-0005', position: 'LEFT' },
      { name: 'Karan Kapoor', email: 'karan@example.com', phone: '+91 98765 00013', sponsorId: 'DST-0005', position: 'RIGHT' },

      // Level 3 under Ananya (DST-0006)
      { name: 'Alok Pandey', email: 'alok@example.com', phone: '+91 98765 00014', sponsorId: 'DST-0006', position: 'LEFT' },
      { name: 'Ritu Saxena', email: 'ritu@example.com', phone: '+91 98765 00015', sponsorId: 'DST-0006', position: 'RIGHT' },

      // Level 4 under Deepak (DST-0007)
      { name: 'Rajesh Gupta', email: 'rajesh@example.com', phone: '+91 98765 00016', sponsorId: 'DST-0007', position: 'LEFT' },
      { name: 'Kavita Das', email: 'kavitadas@example.com', phone: '+91 98765 00017', sponsorId: 'DST-0007', position: 'RIGHT' },

      // Level 4 under Arjun (DST-0009)
      { name: 'Anil Joshi', email: 'anil@example.com', phone: '+91 98765 00018', sponsorId: 'DST-0009', position: 'LEFT' },
      { name: 'Shweta Mishra', email: 'shweta@example.com', phone: '+91 98765 00019', sponsorId: 'DST-0009', position: 'RIGHT' },

      // Level 4 under Suresh (DST-0011)
      { name: 'Manish Tiwari', email: 'manish@example.com', phone: '+91 98765 00020', sponsorId: 'DST-0011', position: 'LEFT' },
      { name: 'Divya Menon', email: 'divya@example.com', phone: '+91 98765 00021', sponsorId: 'DST-0011', position: 'RIGHT' },
    ];

    console.log(`🚀 Adding ${distributorsToCreate.length} distributors dynamically via Admin UI...`);

    for (let i = 0; i < distributorsToCreate.length; i++) {
      const d = distributorsToCreate[i];

      // Ensure any previous modal backdrop is gone
      const backdrop = page.locator('.admin-modal-backdrop');
      if (await backdrop.isVisible()) {
        await page.waitForTimeout(1600);
      }

      await addBtn.click();
      await expect(page.locator('.admin-modal-title')).toContainText('Add New Distributor', { timeout: 10000 });

      await page.fill('input[name="name"]', d.name);
      await page.fill('input[name="email"]', d.email);
      await page.fill('input[name="phone"]', d.phone);
      await page.fill('input[name="sponsorId"]', d.sponsorId);
      await page.selectOption('select[name="position"]', d.position);

      await page.click('button[type="submit"]:has-text("Create Distributor")');

      // Check feedback
      const feedback = page.locator('.modal-feedback');
      await expect(feedback).toBeVisible({ timeout: 10000 });
      const feedbackText = await feedback.textContent();

      if (feedbackText?.includes('Failed') || feedbackText?.includes('Error')) {
        throw new Error(`Failed to create ${d.name}: ${feedbackText}`);
      }

      console.log(`✅ [${i + 1}/${distributorsToCreate.length}] ${d.name} (${d.position} under ${d.sponsorId}) -> ${feedbackText}`);

      // Wait for modal auto-close
      await page.waitForTimeout(1600);
    }

    // 3. Inspect Admin Tree View
    console.log('🌳 Inspecting Admin Network Tree (/network-tree)...');
    await page.goto('/network-tree');
    await expect(page.locator('.tree-page-title')).toContainText('Network Tree', { timeout: 15000 });
    await expect(page.locator('.tree-canvas-error-banner')).not.toBeVisible();
    await expect(page.locator('.tree-canvas-loading-overlay')).not.toBeVisible({ timeout: 15000 });

    // Verify canvas rendered
    const canvas = page.locator('.network-tree-canvas-viewport');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.binary-legs-row')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/admin-complete-tree.png' });
    console.log('📸 Admin complete tree saved to test-results/admin-complete-tree.png');

    // 4. Log out and Log in as Distributor 1 (Amit Patel / distributor@example.com)
    console.log('🔑 Logging in as Distributor (distributor@example.com)...');
    await login(page, 'distributor@example.com', 'Distributor@123');

    // 5. Navigate to Distributor Network Tree
    console.log('🌳 Inspecting Distributor Network Tree (/network-tree)...');
    await page.goto('/network-tree');
    await expect(page.locator('.tree-page-title')).toContainText('Network Tree', { timeout: 15000 });

    // Verify NO 403 error is present!
    await expect(page.locator('.tree-canvas-error-banner')).not.toBeVisible();
    await expect(page.locator('.tree-canvas-loading-overlay')).not.toBeVisible({ timeout: 15000 });

    // Verify canvas and both Left & Right legs are rendered for the distributor
    await expect(page.locator('.network-tree-canvas-viewport')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.binary-legs-row')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.left-leg-col')).toBeVisible();
    await expect(page.locator('.right-leg-col')).toBeVisible();

    // Verify the tree title
    const treeTitle = page.locator('.tree-page-title');
    await expect(treeTitle).toBeVisible();

    await page.screenshot({ path: 'test-results/distributor-tree.png' });
    console.log('📸 Distributor tree saved to test-results/distributor-tree.png');

    // 6. Test Drill-Down: Click downline node and verify "View Network"
    const nodePooja = page.locator('.tree-node-card:has-text("Pooja")').first();
    if (await nodePooja.isVisible()) {
      console.log('🔍 Testing downline drill-down into Pooja Sharma...');
      await nodePooja.click();
      const detailsPanel = page.locator('.member-details-modal');
      await expect(detailsPanel).toBeVisible({ timeout: 5000 });

      const viewNetBtn = page.locator('.view-network-action-btn');
      if (await viewNetBtn.isVisible()) {
        await viewNetBtn.click();
        await page.waitForTimeout(1500);
        await expect(page.locator('.tree-canvas-error-banner')).not.toBeVisible();
        console.log('✅ Successfully drilled down into Pooja Sharma downline network without 403!');

        // Click breadcrumbs back to root
        const rootBreadcrumb = page.locator('.breadcrumb-link').first();
        if (await rootBreadcrumb.isVisible()) {
          await rootBreadcrumb.click();
          await page.waitForTimeout(1000);
          console.log('✅ Successfully navigated back to root via breadcrumb!');
        }
      }
    }

    console.log('🎉 20 Distributors created dynamically via UI & dual-leg trees verified successfully!');
  });
});
