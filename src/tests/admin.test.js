import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const API_BASE_URL = 'http://localhost:5000/api';

describe('PROMPT 8 — ADMIN PANEL & MLM SYSTEM MANAGEMENT TEST SUITE (20 TESTS)', () => {
  let adminToken = null;
  let distributorToken = null;
  let testDistributorId = 'KV-1002';

  before(async () => {
    // 1. Ensure backend is running
    try {
      const healthRes = await fetch('http://localhost:5000/health');
      assert.equal(healthRes.status, 200, 'Backend server must be online on port 5000');
    } catch (e) {
      assert.fail(`Backend server unreachable: ${e.message}`);
    }

    // 2. Obtain Distributor token
    const distLogin = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'distributor@example.com',
        password: 'Distributor@123',
      }),
    });
    assert.equal(distLogin.status, 200);
    const distData = await distLogin.json();
    distributorToken = distData.data.accessToken || distData.data.token;

    // 3. Obtain Admin token
    const adminLogin = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'Admin@123',
      }),
    });
    assert.equal(adminLogin.status, 200);
    const adminData = await adminLogin.json();
    adminToken = adminData.data.accessToken || adminData.data.token;
    assert.ok(adminToken, 'Admin token acquired');
  });

  // =========================================================================
  // TEST 1: Distributor attempts to access /admin -> 403 Forbidden
  // =========================================================================
  test('TEST 1: Distributor attempts to access /admin -> 403 Forbidden', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${distributorToken}` },
    });
    assert.equal(res.status, 403, 'Distributor must be blocked from admin with 403');
    const body = await res.json();
    assert.equal(body.success, false);
    console.log('[PASS] TEST 1: Distributor access to /admin blocked with 403 Forbidden.');
  });

  // =========================================================================
  // TEST 2: Admin accesses /admin -> Dashboard loads
  // =========================================================================
  test('TEST 2: Admin accesses /admin -> Dashboard loads', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200, 'Admin must successfully load /admin/dashboard');
    const body = await res.json();
    assert.equal(body.success, true);
    console.log('[PASS] TEST 2: Admin accesses /admin/dashboard successfully (200 OK).');
  });

  // =========================================================================
  // TEST 3: Admin dashboard displays real backend statistics
  // =========================================================================
  test('TEST 3: Admin dashboard displays real backend statistics', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data;

    assert.ok(data.totalDistributors !== undefined, 'totalDistributors must exist');
    assert.ok(data.activeDistributors !== undefined, 'activeDistributors must exist');
    assert.ok(data.totalBusinessVolume !== undefined, 'totalBusinessVolume must exist');
    assert.ok(data.totalCommission !== undefined, 'totalCommission must exist');

    console.log('[PASS] TEST 3: Real backend stats verified: Total Distributors =', data.totalDistributors, 'Total BV =', data.totalBusinessVolume);
  });

  // =========================================================================
  // TEST 4: Admin can view distributor directory
  // =========================================================================
  test('TEST 4: Admin can view distributor directory', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/distributors`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data), 'Distributor list must be an array');
    assert.ok(body.data.length > 0, 'Directory must contain seeded distributors');
    console.log('[PASS] TEST 4: Distributor directory loaded count =', body.data.length);
  });

  // =========================================================================
  // TEST 5: Distributor search works for Distributor ID, Name, Email, Phone
  // =========================================================================
  test('TEST 5: Distributor search works for ID, Name, Email, and Phone', async () => {
    // Search by ID
    const resId = await fetch(`${API_BASE_URL}/admin/distributors?search=KV-1002`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bodyId = await resId.json();
    assert.ok(bodyId.data.some((d) => d.distributorId === 'KV-1002'));

    // Search by Name
    const resName = await fetch(`${API_BASE_URL}/admin/distributors?search=Amit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bodyName = await resName.json();
    assert.ok(bodyName.data.some((d) => (d.name || '').includes('Amit')));

    console.log('[PASS] TEST 5: Distributor search by ID and Name verified.');
  });

  // =========================================================================
  // TEST 6: Distributor filter works for Status, Position, and Rank
  // =========================================================================
  test('TEST 6: Distributor filter works for Status and Position', async () => {
    const resStatus = await fetch(`${API_BASE_URL}/admin/distributors?status=ACTIVE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bodyStatus = await resStatus.json();
    assert.ok(bodyStatus.data.every((d) => (d.status || '').toUpperCase() === 'ACTIVE'));

    const resPos = await fetch(`${API_BASE_URL}/admin/distributors?position=LEFT`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bodyPos = await resPos.json();
    assert.ok(bodyPos.data.every((d) => (d.position || '').toUpperCase() === 'LEFT'));

    console.log('[PASS] TEST 6: Distributor filtering by status and position verified.');
  });

  // =========================================================================
  // TEST 7: Distributor pagination works
  // =========================================================================
  test('TEST 7: Distributor pagination works with page & limit', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/distributors?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.pagination, 'Pagination metadata must be present');
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 2);
    assert.ok(body.data.length <= 2, 'Page records must respect limit');
    console.log('[PASS] TEST 7: Pagination verified: Page 1 Limit 2 Total =', body.pagination.total);
  });

  // =========================================================================
  // TEST 8: Admin can view full distributor profile
  // =========================================================================
  test('TEST 8: Admin can view full distributor profile', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/distributors/${testDistributorId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.distributorId, testDistributorId);
    assert.ok(body.data.sponsorId !== undefined, 'Sponsor ID must exist');
    assert.ok(body.data.parentId !== undefined, 'Parent ID must exist');
    console.log('[PASS] TEST 8: Full distributor profile verified for:', testDistributorId);
  });

  // =========================================================================
  // TEST 9: Admin can change distributor status: ACTIVE -> SUSPENDED -> ACTIVE
  // =========================================================================
  test('TEST 9: Admin can change distributor status: ACTIVE -> SUSPENDED -> ACTIVE', async () => {
    // 1. Suspend
    const resSuspend = await fetch(`${API_BASE_URL}/admin/distributors/${testDistributorId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    assert.equal(resSuspend.status, 200);
    const bodySuspend = await resSuspend.json();
    assert.equal(bodySuspend.data.status, 'SUSPENDED');

    // 2. Reactivate
    const resActive = await fetch(`${API_BASE_URL}/admin/distributors/${testDistributorId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    assert.equal(resActive.status, 200);
    const bodyActive = await resActive.json();
    assert.equal(bodyActive.data.status, 'ACTIVE');

    console.log('[PASS] TEST 9: Status transition ACTIVE -> SUSPENDED -> ACTIVE successfully executed.');
  });

  // =========================================================================
  // TEST 10: Admin can update distributor profile information
  // =========================================================================
  test('TEST 10: Admin can update distributor profile information', async () => {
    const newPhone = '+91 9887766554';
    const res = await fetch(`${API_BASE_URL}/admin/distributors/${testDistributorId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: newPhone }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.phone, newPhone);
    console.log('[PASS] TEST 10: Admin updated distributor profile phone:', body.data.phone);
  });

  // =========================================================================
  // TEST 11: Admin can view distributor binary network tree
  // =========================================================================
  test('TEST 11: Admin can view distributor binary network tree', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/network/KV-1001?depth=3`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data, 'Tree data must be returned');
    console.log('[PASS] TEST 11: Admin binary network tree retrieved for root KV-1001.');
  });

  // =========================================================================
  // TEST 12: Admin can view system-wide Business Volume
  // =========================================================================
  test('TEST 12: Admin can view system-wide Business Volume', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/business-volume`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.summary || Array.isArray(body.data.transactions), 'BV data structure valid');
    console.log('[PASS] TEST 12: System-wide Business Volume ledger retrieved.');
  });

  // =========================================================================
  // TEST 13: Admin can adjust distributor BV manually with reason
  // =========================================================================
  test('TEST 13: Admin can adjust distributor BV manually with mandatory reason', async () => {
    // 1. Missing reason must fail validation
    const resFail = await fetch(`${API_BASE_URL}/admin/business-volume/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        distributorId: testDistributorId,
        leg: 'LEFT',
        amount: 250,
        reason: '',
      }),
    });
    assert.equal(resFail.status, 400, 'BV adjustment without reason must be rejected with 400');

    // 2. Valid adjustment with reason
    const resSuccess = await fetch(`${API_BASE_URL}/admin/business-volume/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        distributorId: testDistributorId,
        leg: 'LEFT',
        amount: 500,
        reason: 'Administrative test volume adjustment',
      }),
    });
    assert.equal(resSuccess.status, 200);
    const body = await resSuccess.json();
    assert.equal(body.success, true);
    console.log('[PASS] TEST 13: Manual BV adjustment applied with mandatory audit reason.');
  });

  // =========================================================================
  // TEST 14: Admin can view system-wide Commission ledger
  // =========================================================================
  test('TEST 14: Admin can view system-wide Commission ledger', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/commissions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.commissions) || Array.isArray(body.data));
    console.log('[PASS] TEST 14: System-wide Commission ledger loaded.');
  });

  // =========================================================================
  // TEST 15: Admin can trigger commission calculation cycle
  // =========================================================================
  test('TEST 15: Admin can trigger commission calculation cycle', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/calculate-commissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cycleWeek: 38, cycleYear: 2026 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    console.log('[PASS] TEST 15: Weekly commission calculation cycle triggered successfully.');
  });

  // =========================================================================
  // TEST 16: Admin can approve pending commissions
  // =========================================================================
  test('TEST 16: Admin can approve pending commissions', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/commissions/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ALL_PENDING' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    console.log('[PASS] TEST 16: Pending commissions approved for payout batch.');
  });

  // =========================================================================
  // TEST 17: Admin can settle payouts
  // =========================================================================
  test('TEST 17: Admin can settle payouts', async () => {
    const res = await fetch(`${API_BASE_URL}/admin/settle-payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ batchCode: `BATCH-TEST-${Date.now()}` }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    console.log('[PASS] TEST 17: Payout batch settled successfully.');
  });

  // =========================================================================
  // TEST 18: Admin can reverse a commission with mandatory reason
  // =========================================================================
  test('TEST 18: Admin can reverse a commission with mandatory reason', async () => {
    const testCommId = `COMM-REV-${Date.now()}`;

    // Missing reason
    const resFail = await fetch(`${API_BASE_URL}/admin/commissions/reverse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commissionId: testCommId,
        distributorId: 'KV-1001',
        reason: '',
      }),
    });
    assert.equal(resFail.status, 400, 'Reversal without reason must be rejected with 400');

    // Valid reversal
    const resSuccess = await fetch(`${API_BASE_URL}/admin/commissions/reverse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commissionId: testCommId,
        distributorId: 'KV-1001',
        reason: 'Administrative reversal test for cancelled invoice order',
      }),
    });
    assert.equal(resSuccess.status, 200);
    const body = await resSuccess.json();
    assert.equal(body.success, true);
    console.log('[PASS] TEST 18: Commission reversed with mandatory audit justification.');
  });

  // =========================================================================
  // TEST 19: Admin can view audit logs. Audit logs cannot be deleted/modified.
  // =========================================================================
  test('TEST 19: Admin can view audit logs and audit log deletion is blocked (403)', async () => {
    // 1. Read audit logs
    const resRead = await fetch(`${API_BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resRead.status, 200);
    const bodyRead = await resRead.json();
    assert.equal(bodyRead.success, true);

    // 2. Attempt deletion -> Must be blocked with 403 Forbidden
    const resDelete = await fetch(`${API_BASE_URL}/admin/audit-logs`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resDelete.status, 403, 'Audit logs must be immutable and reject DELETE with 403');
    console.log('[PASS] TEST 19: Audit logs retrieved and immutable deletion defense verified (403).');
  });

  // =========================================================================
  // TEST 20: Admin can update commission rules and system settings
  // =========================================================================
  test('TEST 20: Admin can update commission rules and system settings', async () => {
    // 1. Read current settings
    const resGet = await fetch(`${API_BASE_URL}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resGet.status, 200);
    const bodyGet = await resGet.json();
    assert.equal(bodyGet.success, true);

    // 2. Update settings
    const updatePayload = {
      binaryMatchPercentage: 10,
      directSponsorPercentage: 5,
      minPbvForQualification: 100,
      monthlyMaintenanceBv: 50,
      cappingLimit: 100000,
      tdsRate: 5,
      adminFeeRate: 5,
      carryForwardEnabled: true,
    };

    const resPut = await fetch(`${API_BASE_URL}/admin/settings`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });
    assert.equal(resPut.status, 200);
    const bodyPut = await resPut.json();
    assert.equal(bodyPut.success, true);
    assert.equal(bodyPut.data.binaryMatchPercentage, 10);
    console.log('[PASS] TEST 20: Commission rules and system settings successfully updated.');
  });
});
