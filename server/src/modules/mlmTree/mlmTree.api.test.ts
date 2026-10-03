import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { app } from '../../app.js';

describe('PROMPT 19 — MLM NETWORK TREE REST API & INTEGRATION TESTS', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        console.log(`[API Test Server] Running at ${baseUrl}`);
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      if ('closeAllConnections' in server && typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      server.close(() => resolve());
    });
  });

  // 1. GET /api/v1/network-tree
  it('GET /api/v1/network-tree returns default network tree with root', async () => {
    const res = await fetch(`${baseUrl}/api/v1/network-tree`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data?.root, 'Tree data must contain root node');
    assert.strictEqual(body.data.root.distributorId, 'KV-1001');
    assert.ok(body.data.root.name.includes('Rahul'));
    console.log('[API PASS] /api/v1/network-tree returned 200 with root KV-1001');
  });

  // 2. GET /api/v1/network-tree/member/:distributorId
  it('GET /api/v1/network-tree/member/KV-1002 returns Amit subtree with children', async () => {
    const res = await fetch(`${baseUrl}/api/v1/network-tree/member/KV-1002`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data?.root);
    assert.strictEqual(body.data.root.distributorId, 'KV-1002');
    console.log('[API PASS] /api/v1/network-tree/member/KV-1002 returned Amit node');
  });

  // 3. GET /api/v1/network-tree/member/:distributorId/summary
  it('GET /api/v1/network-tree/member/KV-1001/summary returns team and BV metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/network-tree/member/KV-1001/summary`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data?.totalTeamCount !== undefined);
    assert.ok(body.data?.leftBV !== undefined);
    assert.ok(body.data?.rightBV !== undefined);
    console.log('[API PASS] /api/v1/network-tree/member/KV-1001/summary returned metrics');
  });

  // 4. GET /api/v1/network-tree/search?q=Amit
  it('GET /api/v1/network-tree/search?q=Amit returns search matches', async () => {
    const res = await fetch(`${baseUrl}/api/v1/network-tree/search?q=Amit`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((m: any) => m.name.includes('Amit') || m.distributorId === 'KV-1002'));
    console.log('[API PASS] /api/v1/network-tree/search?q=Amit matched distributor');
  });

  // 5. GET /api/v1/sponsors/KV-1001
  it('GET /api/v1/sponsors/KV-1001 verifies active sponsor', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sponsors/KV-1001`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data?.isValid, true);
    assert.strictEqual(body.data?.sponsor?.distributorId, 'KV-1001');
    assert.strictEqual(body.data?.sponsor?.status, 'ACTIVE');
    console.log('[API PASS] /api/v1/sponsors/KV-1001 returned active sponsor status');
  });

  // 6. GET /api/v1/sponsors/INVALID
  it('GET /api/v1/sponsors/INVALID rejects non-existent sponsor', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sponsors/INVALID`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data?.isValid, false);
    console.log('[API PASS] /api/v1/sponsors/INVALID rejected');
  });

  // 7. GET /api/v1/sponsors/KV-1005 (Suspended)
  it('GET /api/v1/sponsors/KV-1005 rejects suspended sponsor', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sponsors/KV-1005`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data?.isValid, false);
    assert.ok(body.data?.message?.includes('SUSPENDED') || body.data?.message?.includes('inactive'));
    console.log('[API PASS] /api/v1/sponsors/KV-1005 suspended sponsor rejected');
  });

  // 8. GET /api/v1/admin/network-tree without admin JWT -> 401 or 403 Forbidden
  it('GET /api/v1/admin/network-tree blocks unauthenticated or non-admin requests with 401/403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/network-tree`);
    assert.ok(res.status === 401 || res.status === 403, `Status should be 401/403, got ${res.status}`);
    console.log(`[API PASS] Unauthenticated admin network tree request blocked with status ${res.status}`);
  });

  // 9. POST /api/v1/tree/move without mandatory reason -> 400 Bad Request
  it('POST /api/v1/tree/move rejects missing mandatory fields with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tree/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'KV-1004',
        // missing reason, oldParent, etc.
      }),
    });
    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message?.includes('required'));
    console.log('[API PASS] Incomplete move rejected with 400: ' + body.message);
  });

  // 10. POST /api/v1/tree/move circular hierarchy protection
  it('POST /api/v1/tree/move rejects circular placement attempt with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tree/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'KV-1001',
        newParent: 'KV-1001', // placing under themselves
        oldParent: 'ROOT',
        oldPosition: 'ROOT',
        newPosition: 'LEFT',
        reason: 'Invalid self-placement test',
        adminId: 'usr-admin-001',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message?.includes('Circular') || body.message?.includes('cannot be placed under themselves'));
    console.log('[API PASS] Circular placement rejected with 400: ' + body.message);
  });
});
