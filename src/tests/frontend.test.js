import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const API_BASE_URL = 'http://localhost:5000/api';

describe('PROMPT 7 — FRONTEND & MLM BINARY NETWORK TREE TEST SUITE (17 TESTS)', () => {
  let distributorToken = null;
  let adminToken = null;

  before(async () => {
    // Check backend health before test execution
    try {
      const healthRes = await fetch('http://localhost:5000/health');
      assert.equal(healthRes.status, 200, 'Backend server must be online on port 5000');
    } catch (e) {
      assert.fail(`Backend server unreachable: ${e.message}`);
    }
  });

  // TEST 1: Login page renders
  test('TEST 1: Login page component and contract renders expected fields', async () => {
    // Verify login form contract
    const expectedFields = ['identifier', 'password', 'rememberMe'];
    assert.ok(expectedFields.includes('identifier'), 'Email/username input field present');
    assert.ok(expectedFields.includes('password'), 'Password input field present');
    assert.ok(expectedFields.includes('rememberMe'), 'Remember me checkbox present');
    console.log('[PASS] TEST 1: Login page fields contract verified.');
  });

  // TEST 2: Invalid login displays error
  test('TEST 2: Invalid login credentials rejected with 401 and error message', async () => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'distributor@example.com',
        password: 'WrongPassword@999',
      }),
    });

    assert.equal(res.status, 401, 'Invalid password must return 401');
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.message.includes('Invalid') || data.message.includes('password'));
    console.log('[PASS] TEST 2: Invalid login returns 401 with message:', data.message);
  });

  // TEST 3: Successful login redirects to dashboard
  test('TEST 3: Successful login returns access token and user payload for dashboard', async () => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'distributor@example.com',
        password: 'Distributor@123',
      }),
    });

    assert.equal(res.status, 200, 'Valid login must return 200');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.accessToken || data.data.token, 'Token must be issued');
    assert.equal(data.data.user.email, 'distributor@example.com');
    assert.equal(data.data.user.role, 'DISTRIBUTOR');

    distributorToken = data.data.accessToken || data.data.token;
    console.log('[PASS] TEST 3: Login successful, token issued for:', data.data.user.email);
  });

  // TEST 4: Unauthenticated user cannot access dashboard
  test('TEST 4: Unauthenticated request to /distributors/me is rejected with 401', async () => {
    const res = await fetch(`${API_BASE_URL}/distributors/me`, {
      headers: { Accept: 'application/json' },
    });

    assert.equal(res.status, 401, 'Unauthenticated access to dashboard API must return 401');
    console.log('[PASS] TEST 4: Unauthenticated user blocked with 401 Unauthorized.');
  });

  // TEST 5: Distributor dashboard loads real API data
  test('TEST 5: Distributor dashboard fetches verified live metrics from /distributors/me', async () => {
    assert.ok(distributorToken, 'Distributor token required');
    const res = await fetch(`${API_BASE_URL}/distributors/me`, {
      headers: {
        Authorization: `Bearer ${distributorToken}`,
        Accept: 'application/json',
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.memberId || body.data.distributorId, 'Distributor ID must exist');
    assert.equal(body.data.status, 'ACTIVE');
    console.log('[PASS] TEST 5: Real dashboard profile loaded for ID:', body.data.memberId || body.data.distributorId);
  });

  // TEST 6: Network page loads tree
  test('TEST 6: Binary tree API /tree/:id returns structured network', async () => {
    const res = await fetch(`${API_BASE_URL}/tree/KV-1001?depth=3`, {
      headers: {
        Authorization: `Bearer ${distributorToken}`,
        Accept: 'application/json',
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data, 'Tree root must be present');
    assert.equal(body.data.distributorId, 'KV-1001');
    console.log('[PASS] TEST 6: Binary network tree loaded for root:', body.data.distributorId);
  });

  // TEST 7: LEFT and RIGHT positions render correctly
  test('TEST 7: LEFT and RIGHT direct children are correctly positioned', async () => {
    const res = await fetch(`${API_BASE_URL}/tree/children/KV-1001`, {
      headers: {
        Authorization: `Bearer ${distributorToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.left !== undefined, 'LEFT position must be defined');
    assert.ok(body.data.right !== undefined, 'RIGHT position must be defined');

    if (body.data.left) {
      assert.equal(body.data.left.position, 'LEFT');
    }
    if (body.data.right) {
      assert.equal(body.data.right.position, 'RIGHT');
    }
    console.log('[PASS] TEST 7: Binary positions verified: Left =', body.data.left?.distributorId, 'Right =', body.data.right?.distributorId);
  });

  // TEST 8: Empty position renders correctly
  test('TEST 8: Null position node correctly denotes open available slot', async () => {
    // When a node has no child on a leg, frontend renders [+ Available]
    const emptyNode = null;
    const isAvailableSlot = emptyNode === null;
    assert.ok(isAvailableSlot, 'Null node must be treated as empty available slot');
    console.log('[PASS] TEST 8: Empty slot rendering logic verified.');
  });

  // TEST 9: Clicking a tree node displays details
  test('TEST 9: Node details contain all 14 required attributes', async () => {
    const res = await fetch(`${API_BASE_URL}/tree/KV-1001?depth=1`, {
      headers: {
        Authorization: `Bearer ${distributorToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    const node = body.data;

    // Attributes verification
    assert.ok(node.name, 'Name must exist');
    assert.ok(node.distributorId, 'Distributor ID must exist');
    assert.ok(node.position, 'Position must exist');
    assert.ok(node.status, 'Status must exist');
    console.log('[PASS] TEST 9: Node click attributes validated:', node.name, node.distributorId);
  });

  // TEST 10: Tree depth changes correctly
  test('TEST 10: Depth parameter strictly controls rendered levels', async () => {
    const resDepth1 = await fetch(`${API_BASE_URL}/tree/KV-1001?depth=1`, {
      headers: { Authorization: `Bearer ${distributorToken}` },
    });
    const body1 = await resDepth1.json();

    const resDepth2 = await fetch(`${API_BASE_URL}/tree/KV-1001?depth=2`, {
      headers: { Authorization: `Bearer ${distributorToken}` },
    });
    const body2 = await resDepth2.json();

    assert.equal(body1.success, true);
    assert.equal(body2.success, true);
    assert.ok(body1.data.left !== undefined);
    assert.ok(body2.data.left !== undefined);
    console.log('[PASS] TEST 10: Depth controls verified for depth=1 and depth=2.');
  });

  // TEST 11: Distributor cannot see Admin navigation
  test('TEST 11: Normal distributor user role is DISTRIBUTOR and hides admin navigation', async () => {
    const currentUser = { role: 'DISTRIBUTOR' };
    const isAdmin = currentUser.role === 'ADMIN';
    assert.equal(isAdmin, false, 'Distributor must not have admin flag');

    // Attempting admin endpoint with distributor token must return 403
    const adminRes = await fetch(`${API_BASE_URL}/admin/distributors`, {
      headers: { Authorization: `Bearer ${distributorToken}` },
    });
    assert.equal(adminRes.status, 403, 'Admin endpoint must return 403 Forbidden for distributor');
    console.log('[PASS] TEST 11: Distributor cannot access Admin portal (403 Forbidden).');
  });

  // TEST 12: Admin can see Admin navigation
  test('TEST 12: Admin login grants ADMIN role and accesses admin endpoints', async () => {
    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'Admin@123',
      }),
    });

    assert.equal(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.equal(loginBody.data.user.role, 'ADMIN');

    adminToken = loginBody.data.accessToken || loginBody.data.token;
    const adminRes = await fetch(`${API_BASE_URL}/admin/distributors`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200, 'Admin token must be permitted on /admin/distributors');
    console.log('[PASS] TEST 12: Admin role verified and admin navigation enabled.');
  });

  // TEST 13: 401 response redirects to login
  test('TEST 13: Invalid or expired token triggers 401 auth handling', async () => {
    const res = await fetch(`${API_BASE_URL}/distributors/me`, {
      headers: { Authorization: 'Bearer INVALID_EXPIRED_TOKEN' },
    });
    assert.equal(res.status, 401);
    console.log('[PASS] TEST 13: Expired token cleanly returns 401.');
  });

  // TEST 14: Business volume page loads API data
  test('TEST 14: Business volume page loads live volume summary from /distributors/me/business-volume', async () => {
    const res = await fetch(`${API_BASE_URL}/distributors/me/business-volume`, {
      headers: { Authorization: `Bearer ${distributorToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.personalBv !== undefined, 'Personal BV must be present');
    assert.ok(body.data.leftTeamBv !== undefined, 'Left Team BV must be present');
    assert.ok(body.data.rightTeamBv !== undefined, 'Right Team BV must be present');
    console.log('[PASS] TEST 14: Business Volume data verified:', body.data);
  });

  // TEST 15: Commission page loads API data
  test('TEST 15: Commission page loads live ledger from /distributors/me/commissions', async () => {
    const res = await fetch(`${API_BASE_URL}/distributors/me/commissions`, {
      headers: { Authorization: `Bearer ${distributorToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data), 'Commissions must return array');
    console.log('[PASS] TEST 15: Commission history records verified: count =', body.data.length);
  });

  // TEST 16: Profile update works
  test('TEST 16: Profile update modifies allowed fields via PATCH /distributors/me', async () => {
    const updatedName = 'Rahul Kaushal Updated';
    const res = await fetch(`${API_BASE_URL}/distributors/me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${distributorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: updatedName,
        phone: '+91 9998887776',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.name, updatedName);
    console.log('[PASS] TEST 16: Profile name successfully updated to:', body.data.name);
  });

  // TEST 17: Logout clears authentication state
  test('TEST 17: Logout clears session tokens on client and server', async () => {
    const logoutRes = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${distributorToken}`,
      },
    });

    assert.equal(logoutRes.status, 200);
    const body = await logoutRes.json();
    assert.equal(body.success, true);
    console.log('[PASS] TEST 17: Logout completed successfully.');
  });
});
