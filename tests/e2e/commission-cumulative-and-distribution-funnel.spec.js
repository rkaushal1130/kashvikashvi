import { test, expect } from '@playwright/test';

test.describe('Commission Stacking, Distribution Funnel & Withdrawal E2E Suite', () => {
  const ts = Date.now().toString().slice(-6);

  test('TC-COMM-01: Cumulative commission stacking: Silver, Gold, Platinum, Diamond, Ruby tiers stack correctly', async ({ request }) => {
    const baseAmount = 1000;

    // 1. Silver rank: Silver only (24%)
    const resSilver = await request.post('http://localhost:5001/api/v1/commissions/cumulative/preview', {
      data: { rank: 'SILVER', baseAmount },
    });
    expect(resSilver.status()).toBe(200);
    const dataSilver = (await resSilver.json()).data;
    expect(dataSilver.rank).toBe('SILVER');
    expect(dataSilver.cumulativePercentage).toBe(24);
    expect(dataSilver.totalPreview).toBe(240);
    expect(dataSilver.tiers.length).toBe(1);
    expect(dataSilver.tiers[0].rankCode).toBe('SILVER');
    expect(dataSilver.tiers[0].percentage).toBe(24);
    expect(dataSilver.tiers[0].calculatedAmount).toBe(240);

    // 2. Gold rank: Silver (24%) + Gold (8%) = 32% (320)
    const resGold = await request.post('http://localhost:5001/api/v1/commissions/cumulative/preview', {
      data: { rank: 'GOLD', baseAmount },
    });
    expect(resGold.status()).toBe(200);
    const dataGold = (await resGold.json()).data;
    expect(dataGold.rank).toBe('GOLD');
    expect(dataGold.cumulativePercentage).toBe(32);
    expect(dataGold.totalPreview).toBe(320);
    expect(dataGold.tiers.length).toBe(2);
    expect(dataGold.tiers[0].rankCode).toBe('SILVER');
    expect(dataGold.tiers[0].percentage).toBe(24);
    expect(dataGold.tiers[1].rankCode).toBe('GOLD');
    expect(dataGold.tiers[1].percentage).toBe(8);

    // 3. Platinum rank: Silver (24%) + Gold (8%) + Platinum (13%) = 45% (450)
    const resPlatinum = await request.post('http://localhost:5001/api/v1/commissions/cumulative/preview', {
      data: { rank: 'PLATINUM', baseAmount },
    });
    expect(resPlatinum.status()).toBe(200);
    const dataPlatinum = (await resPlatinum.json()).data;
    expect(dataPlatinum.rank).toBe('PLATINUM');
    expect(dataPlatinum.cumulativePercentage).toBe(45);
    expect(dataPlatinum.totalPreview).toBe(450);
    expect(dataPlatinum.tiers.length).toBe(3);
    expect(dataPlatinum.tiers[0].rankCode).toBe('SILVER');
    expect(dataPlatinum.tiers[1].rankCode).toBe('GOLD');
    expect(dataPlatinum.tiers[2].rankCode).toBe('PLATINUM');
    expect(dataPlatinum.tiers[2].percentage).toBe(13);

    // 4. Diamond rank: Silver (24%) + Gold (8%) + Platinum (13%) + Diamond (5%) = 50% (500)
    const resDiamond = await request.post('http://localhost:5001/api/v1/commissions/cumulative/preview', {
      data: { rank: 'DIAMOND', baseAmount },
    });
    expect(resDiamond.status()).toBe(200);
    const dataDiamond = (await resDiamond.json()).data;
    expect(dataDiamond.rank).toBe('DIAMOND');
    expect(dataDiamond.cumulativePercentage).toBe(50);
    expect(dataDiamond.totalPreview).toBe(500);
    expect(dataDiamond.tiers.length).toBe(4);
    expect(dataDiamond.tiers[0].rankCode).toBe('SILVER');
    expect(dataDiamond.tiers[1].rankCode).toBe('GOLD');
    expect(dataDiamond.tiers[2].rankCode).toBe('PLATINUM');
    expect(dataDiamond.tiers[3].rankCode).toBe('DIAMOND');
    expect(dataDiamond.tiers[3].percentage).toBe(5);

    // 5. Ruby rank: Silver (24%) + Gold (8%) + Platinum (13%) + Diamond (5%) + Ruby (4%) = 54% (540)
    const resRuby = await request.post('http://localhost:5001/api/v1/commissions/cumulative/preview', {
      data: { rank: 'RUBY', baseAmount },
    });
    expect(resRuby.status()).toBe(200);
    const dataRuby = (await resRuby.json()).data;
    expect(dataRuby.rank).toBe('RUBY');
    expect(dataRuby.cumulativePercentage).toBe(54);
    expect(dataRuby.totalPreview).toBe(540);
    expect(dataRuby.tiers.length).toBe(5);
    expect(dataRuby.tiers[0].rankCode).toBe('SILVER');
    expect(dataRuby.tiers[1].rankCode).toBe('GOLD');
    expect(dataRuby.tiers[2].rankCode).toBe('PLATINUM');
    expect(dataRuby.tiers[3].rankCode).toBe('DIAMOND');
    expect(dataRuby.tiers[4].rankCode).toBe('RUBY');
    expect(dataRuby.tiers[4].percentage).toBe(4);
  });

  test('TC-COMM-02: End-to-End Admin commission distribution preview and treasury verification', async ({ request }) => {
    // 1. Super Admin login
    const loginRes = await request.post('http://localhost:5001/api/auth/login', {
      data: { email: 'admin@kashvimlm.com', password: 'Admin@Kashvimlm#1001' },
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    const adminToken = loginData.data?.tokens?.accessToken || loginData.data?.accessToken;

    // 2. Fetch commission distribution preview
    const previewRes = await request.post('http://localhost:5001/api/v1/admin/funding/commissions/distribute-preview', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {},
    });
    expect(previewRes.status()).toBe(200);
    const previewJson = await previewRes.json();
    expect(previewJson.success).toBe(true);
    expect(previewJson.data).toHaveProperty('calculationPeriod');
    expect(previewJson.data).toHaveProperty('totalCommissionAmount');

    // 3. Check treasury dashboard
    const dashboardRes = await request.get('http://localhost:5001/api/v1/admin/funding/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(dashboardRes.status()).toBe(200);
    const dashboardJson = await dashboardRes.json();
    expect(dashboardJson.success).toBe(true);

    // 4. Check payout batches
    const batchesRes = await request.get('http://localhost:5001/api/v1/admin/funding/commissions/batches', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(batchesRes.status()).toBe(200);
    const batchesJson = await batchesRes.json();
    expect(batchesJson.success).toBe(true);
  });

  test('TC-COMM-03: Distributor bank account addition, penny-drop verification, and withdrawal flow', async ({ request }) => {
    // 1. Register a test distributor
    const mobile = `92${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await request.post('http://localhost:5001/api/auth/register', {
      data: {
        fullName: 'Commission Test Distributor',
        phone: mobile,
        email: `comm_dist_${ts}_${Math.floor(Math.random() * 1000)}@testkashvi.com`,
        password: 'Password123',
        confirmPassword: 'Password123',
        referralCode: 'KV-1001',
      },
    });
    expect(regRes.status()).toBe(201);
    const regJson = await regRes.json();
    const userToken = regJson.data?.tokens?.accessToken || regJson.data?.accessToken;

    // 2. Add bank account for distributor
    const addBankRes = await request.post('http://localhost:5001/api/v1/funding/bank-accounts', {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        accountHolderName: 'Commission Test Distributor',
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        ifscCode: 'HDFC0001234',
        branchName: 'Main Branch',
        isPrimary: true,
      },
    });
    expect(addBankRes.status()).toBe(201);
    const bankData = (await addBankRes.json()).data;
    const bankId = bankData.account?.id || bankData.id;
    expect(bankId).toBeDefined();

    // 3. Verify bank account via penny-drop validation
    const verifyBankRes = await request.post(`http://localhost:5001/api/v1/funding/bank-accounts/${bankId}/verify`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { autoVerify: true },
    });
    expect(verifyBankRes.status()).toBe(200);
    const verifiedData = (await verifyBankRes.json()).data;
    const verifiedAccount = verifiedData.account || verifiedData;
    expect(verifiedAccount.status).toBe('VERIFIED');

    // 3.5 Top up distributor wallet with ₹1000 via funding rail
    const fundOrder = await request.post('http://localhost:5001/api/v1/funding/orders', {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { amount: 1000, currency: 'INR', paymentMethod: 'RAZORPAY_UPI' },
    });
    expect(fundOrder.status()).toBe(201);
    const fundOrderData = (await fundOrder.json()).data;
    const verifyFund = await request.post('http://localhost:5001/api/v1/funding/verify', {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        orderId: fundOrderData.order.id,
        razorpayOrderId: fundOrderData.razorpayOrderId || `order_${Date.now()}`,
        razorpayPaymentId: `pay_test_${Date.now()}`,
        razorpaySignature: 'valid_mock_signature',
        amount: 1000,
      },
    });
    expect(verifyFund.status()).toBe(200);

    // 4. Request a withdrawal of ₹500 to the verified bank account
    const withdrawRes = await request.post('http://localhost:5001/api/v1/funding/withdraw', {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        amount: 500,
        bankAccountId: bankId,
        notes: 'Test commission payout withdrawal',
      },
    });
    expect(withdrawRes.status()).toBe(201);
    const withdrawJson = await withdrawRes.json();
    expect(withdrawJson.success).toBe(true);
    expect(withdrawJson.data).toHaveProperty('withdrawal');
    expect(withdrawJson.data.withdrawal.amount).toBe(500);
    expect(withdrawJson.data.withdrawal.status).toMatch(/COMPLETED|PENDING|PROCESSED|PROCESSING/);

    // 5. Fetch distributor withdrawal history
    const historyRes = await request.get('http://localhost:5001/api/v1/funding/withdrawals', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(historyRes.status()).toBe(200);
    const historyJson = await historyRes.json();
    expect(historyJson.success).toBe(true);
    expect(historyJson.data.withdrawals.length).toBeGreaterThan(0);
  });

  test('TC-COMM-04: Razorpay funding order initialization and payment verification pipeline', async ({ request }) => {
    // 1. Super Admin login
    const loginRes = await request.post('http://localhost:5001/api/auth/login', {
      data: { email: 'admin@kashvimlm.com', password: 'Admin@Kashvimlm#1001' },
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    const adminToken = loginData.data?.tokens?.accessToken || loginData.data?.accessToken;

    // 2. Initialize a Razorpay funding order
    const orderRes = await request.post('http://localhost:5001/api/v1/funding/orders', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        amount: 1500,
        currency: 'INR',
        paymentMethod: 'RAZORPAY_UPI',
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderJson = await orderRes.json();
    expect(orderJson.success).toBe(true);
    expect(orderJson.data).toHaveProperty('order');
    const rzpOrderId = orderJson.data.razorpayOrderId || orderJson.data.order?.providerOrderId || `order_${Date.now()}`;
    const internalOrderId = orderJson.data.order.id;

    // 3. Verify payment signature with Razorpay integration
    const verifyRes = await request.post('http://localhost:5001/api/v1/funding/verify', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        orderId: internalOrderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: `pay_live_test_${Date.now()}`,
        razorpaySignature: 'valid_mock_signature',
        amount: 1500,
      },
    });
    expect(verifyRes.status()).toBe(200);
    const verifyJson = await verifyRes.json();
    expect(verifyJson.success).toBe(true);
    expect(['COMPLETED', 'SUCCEEDED']).toContain(verifyJson.data.order.status);
  });
});
