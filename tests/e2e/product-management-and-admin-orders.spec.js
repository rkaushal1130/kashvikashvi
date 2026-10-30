import { test, expect } from '@playwright/test';

test.describe('Product Creation, Store Sync, Admin Orders & Role-Restricted Navigation Suite', () => {
  const ts = Date.now().toString().slice(-6);
  const testProductName = `Automated Polo Shirt ${ts}`;

  const login = async (page, identifier, password) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.fill('#email', identifier);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|admin|manage-products)/, { timeout: 15000 });
  };

  test('TC-PROD-01: Admin navigates via Admin sidebar to Product Management and creates a product', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Log in as Super Admin
    await login(page, 'admin@kashvimlm.com', 'Admin@Kashvimlm#1001');

    // 2. Navigate to Admin Console
    await page.goto('/admin/dashboard');

    // 3. Verify Product Management link in Admin Sidebar
    const adminProdLink = page.locator('nav.admin-sidebar-nav a[href="/admin/products"]');
    await expect(adminProdLink).toBeVisible({ timeout: 15000 });
    await adminProdLink.click();

    // 4. Verify route and header
    await expect(page).toHaveURL(/\/admin\/products/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Product & Pricing Management Center/i, level: 1 })).toBeVisible({ timeout: 15000 });

    // 5. Switch to 'Add New Product' tab
    await page.getByRole('button', { name: /Add New Product/i }).click();
    await expect(page.getByText('Add Product to Database Table')).toBeVisible();

    // 6. Fill in product details
    await page.getByPlaceholder(/e\.g\. Combed Cotton Hosiery/i).fill(testProductName);
    
    // Select Category
    await page.locator('select.pm-select').first().selectOption({ label: 'Clothes & Hosiery (Hozri)' });

    // Fill Pricing & BV
    const distPriceInput = page.locator('.pm-form-group').filter({ hasText: 'Distributor Wholesale Price' }).locator('input');
    await distPriceInput.fill('550');

    const mrpInput = page.locator('.pm-form-group').filter({ hasText: 'Maximum Retail Price' }).locator('input');
    await mrpInput.fill('899');

    const bvInput = page.locator('.pm-form-group').filter({ hasText: 'Volume Points' }).locator('input');
    await bvInput.fill('300');

    const stockInput = page.locator('.pm-form-group').filter({ hasText: 'Initial Warehouse Stock' }).locator('input');
    await stockInput.fill('150');

    // 7. Submit form
    await page.getByRole('button', { name: /Save Product to Database/i }).click();

    // 8. Verify success toast and appearance in catalog table
    await expect(page.getByText(/saved to database successfully/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(testProductName).first()).toBeVisible({ timeout: 10000 });
    console.log(`✅ Admin created product in Admin view: ${testProductName}`);
  });

  test('TC-PROD-02: Created product is visible to Distributor in Shop, and Admin items are hidden from Distributor view', async ({ page, request }) => {
    test.setTimeout(60000);

    // 1. Create a regular distributor account
    const distEmail = `shop_dist_${ts}@testkashvi.com`;
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        email: distEmail,
        password: 'Password@1234',
        confirmPassword: 'Password@1234',
        fullName: 'Shop Tester Distributor',
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        referralCode: 'KV-1001',
        acceptTerms: true,
      },
    });
    expect(regRes.status()).toBe(201);

    // 2. Log in as the regular distributor
    await login(page, distEmail, 'Password@1234');
    await page.goto('/dashboard');

    // 3. Verify Product Management & Orders are NOT in the distributor rail
    await expect(page.locator('button.rail-icon-btn[aria-label="Product Management"]')).not.toBeVisible();
    await expect(page.locator('button.rail-icon-btn[aria-label="Orders Management"]')).not.toBeVisible();

    // 4. Verify "Back to Admin Dashboard" button is NOT visible for regular distributor
    await expect(page.locator('button.admin-dashboard-return-btn')).not.toBeVisible();

    // 5. Click Shop icon in the sidebar rail
    const shopRailBtn = page.locator('button.rail-icon-btn[aria-label="Shop"]');
    await expect(shopRailBtn).toBeVisible({ timeout: 15000 });
    await shopRailBtn.click();

    // 6. Verify Shop view is active
    await expect(page.getByRole('heading', { name: /KASHVIMLM Official Product Store/i })).toBeVisible({ timeout: 15000 });

    // 7. Verify the newly created product is visible in the shop catalog
    const productCard = page.locator('.shop-product-card').filter({ hasText: testProductName }).first();
    await expect(productCard).toBeVisible({ timeout: 15000 });

    // 8. Verify price and BV points on the card
    await expect(productCard.getByText('550')).toBeVisible();
    await expect(productCard.getByText('300 BV')).toBeVisible();

    // 9. Verify Add to Cart button works
    const addToCartBtn = productCard.getByRole('button', { name: /Add to Cart/i });
    await expect(addToCartBtn).toBeVisible();
    await addToCartBtn.click();

    // Verify item count in cart toast
    await expect(page.getByText(/Added 1 ×/i)).toBeVisible({ timeout: 10000 });
    console.log(`✅ Distributor can view and add "${testProductName}" to cart in Shop`);
  });

  test('TC-ORD-01: Admin has Back to Admin Dashboard button in Distributor view, and admin routes are protected', async ({ page, request }) => {
    test.setTimeout(60000);

    // 1. Log in as Super Admin
    await login(page, 'admin@kashvimlm.com', 'Admin@Kashvimlm#1001');

    // 2. Go to Distributor Dashboard
    await page.goto('/dashboard');

    // 3. Verify Admin HAS the "Back to Admin Dashboard" button in the top navbar
    const backToAdminBtn = page.locator('button.admin-dashboard-return-btn');
    await expect(backToAdminBtn).toBeVisible({ timeout: 15000 });

    // 4. Click the button and verify redirect to /admin/dashboard
    await backToAdminBtn.click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // 5. Verify Admin sidebar has both Orders and Product Management
    await expect(page.locator('nav.admin-sidebar-nav a[href="/admin/orders"]')).toBeVisible();
    await expect(page.locator('nav.admin-sidebar-nav a[href="/admin/products"]')).toBeVisible();

    // 6. Log out and log in as regular distributor
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const distEmail = `sec_dist_${ts}@testkashvi.com`;
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        email: distEmail,
        password: 'Password@1234',
        confirmPassword: 'Password@1234',
        fullName: 'Security Check Distributor',
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        referralCode: 'KV-1001',
        acceptTerms: true,
      },
    });
    expect(regRes.status()).toBe(201);

    await login(page, distEmail, 'Password@1234');
    await page.goto('/dashboard');

    // 7. Verify "Back to Admin Dashboard" button is NOT rendered for regular distributor
    await expect(page.locator('button.admin-dashboard-return-btn')).not.toBeVisible();

    // 8. Verify direct URL access to /admin/orders and /admin/products is blocked with 403 Access Denied
    await page.goto('/admin/orders');
    await expect(page.getByText('403 — Access Denied')).toBeVisible({ timeout: 10000 });

    await page.goto('/admin/products');
    await expect(page.getByText('403 — Access Denied')).toBeVisible({ timeout: 10000 });

    console.log('✅ Top "Back to Admin Dashboard" button and Admin console security strictly verified');
  });

  test('TC-ORD-02: Admin views Orders table and inspects full order details modal', async ({ page, request }) => {
    test.setTimeout(60000);

    // 1. Create a distributor and place an order using their wallet balance
    const buyerEmail = `buyer_dist_${ts}@testkashvi.com`;
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        email: buyerEmail,
        password: 'Password@1234',
        confirmPassword: 'Password@1234',
        fullName: 'Order Buyer Distributor',
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        referralCode: 'KV-1001',
        acceptTerms: true,
      },
    });
    expect(regRes.status()).toBe(201);
    const regData = await regRes.json();
    const token = regData.data?.tokens?.accessToken;

    // Fetch product to order
    const prodRes = await request.get('http://localhost:5001/api/v1/products');
    const prodData = await prodRes.json();
    const targetProduct = (prodData.data || [])[0];
    expect(targetProduct).toBeDefined();

    // Top up buyer wallet with ₹5000
    const fundOrder = await request.post('http://localhost:5001/api/v1/funding/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: { amount: 5000, currency: 'INR', paymentMethod: 'RAZORPAY_UPI' },
    });
    expect(fundOrder.status()).toBe(201);
    const fundOrderData = (await fundOrder.json()).data;

    const verifyFund = await request.post('http://localhost:5001/api/v1/funding/verify', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        orderId: fundOrderData.order.id,
        razorpayOrderId: fundOrderData.razorpayOrderId || `order_${Date.now()}`,
        razorpayPaymentId: `pay_test_${Date.now()}`,
        razorpaySignature: 'valid_mock_signature',
        amount: 5000,
      },
    });
    expect(verifyFund.status()).toBe(200);

    // Place wholesale order via wallet-checkout
    const orderRes = await request.post('http://localhost:5001/api/v1/orders/wallet-checkout', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        items: [
          {
            productId: targetProduct.id,
            quantity: 2,
          },
        ],
        shippingAddress: {
          recipientName: 'Order Buyer Distributor',
          phone: '9876543210',
          streetAddress: 'Plot 42, Industrial Model Town',
          city: 'Ambala',
          state: 'Haryana',
          postalCode: '134007',
          country: 'India',
        },
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderData = await orderRes.json();
    const createdOrder = orderData.data?.order || orderData.data;
    const orderNum = createdOrder?.orderNumber || createdOrder?.id;
    console.log(`✅ Order placed: #${orderNum}`);

    // 2. Log in as Super Admin and navigate to /admin/orders
    await login(page, 'admin@kashvimlm.com', 'Admin@Kashvimlm#1001');
    await page.goto('/admin/orders');

    // 3. Verify Orders Management page rendered
    await expect(page.getByRole('heading', { name: /Orders Management/i, level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.admin-table')).toBeVisible({ timeout: 15000 });

    // 4. Verify placed order appears in the table
    const orderRow = page.locator('tr.admin-table-row').filter({ hasText: orderNum }).first();
    await expect(orderRow).toBeVisible({ timeout: 15000 });
    await expect(orderRow.getByText('Order Buyer Distributor')).toBeVisible();

    // 5. Open Order Details Modal
    const detailsBtn = orderRow.getByRole('button', { name: /Details/i });
    await detailsBtn.click();

    // 6. Verify modal is displayed with complete order details
    const modal = page.locator('.order-details-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.getByRole('heading', { name: new RegExp(orderNum, 'i') })).toBeVisible();

    // Verify Shipping Destination
    await expect(modal.getByText('Plot 42, Industrial Model Town')).toBeVisible();
    await expect(modal.getByText('Ambala, Haryana - 134007')).toBeVisible();

    // Verify Financial Summary
    await expect(modal.getByText('Financial Summary')).toBeVisible();
    await expect(modal.getByText('Commissionable Volume:')).toBeVisible();

    // 7. Update status to PROCESSING
    const statusSelect = modal.locator('.status-select-wrap select');
    await statusSelect.selectOption('PROCESSING');
    await modal.getByRole('button', { name: /Update Status/i }).click();

    // 8. Verify status update toast
    await expect(page.getByText(/status updated to PROCESSING/i)).toBeVisible({ timeout: 10000 });
    console.log(`✅ Admin successfully inspected order #${orderNum} and updated status to PROCESSING`);
  });
});
