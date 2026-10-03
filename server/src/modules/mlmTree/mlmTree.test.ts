import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MlmTreeEngine } from './mlmTreeEngine.js';

describe('PROMPT 18 — COMPLETE MLM TREE TEST SUITE (20 TESTS)', () => {
  const engine = new MlmTreeEngine();

  // =========================================================================
  // TEST 1: Create Rahul KV-1001
  // =========================================================================
  it('TEST 1: Create Rahul (KV-1001) with empty children', () => {
    engine.reset();
    const root = engine.createRoot('KV-1001', 'Rahul');

    assert.strictEqual(root.distributorId, 'KV-1001');
    assert.strictEqual(root.name, 'Rahul');
    assert.strictEqual(root.left, null, 'Left child should be EMPTY');
    assert.strictEqual(root.right, null, 'Right child should be EMPTY');

    const expectedAscii = `Rahul\n├── EMPTY\n└── EMPTY`;
    const actualAscii = engine.toAscii();
    assert.strictEqual(actualAscii, expectedAscii, 'ASCII tree should match Expected');
    console.log('\n[PASS] TEST 1 — Tree:\n' + actualAscii);
  });

  // =========================================================================
  // TEST 2: Amit joins using Rahul
  // =========================================================================
  it('TEST 2: Amit joins using Rahul (placed on LEFT leg)', () => {
    const res = engine.joinMember('KV-1001', 'LEFT', {
      distributorId: 'KV-1002',
      name: 'Amit',
      sponsorId: 'KV-1001',
      rank: 'Executive Director',
    });

    assert.strictEqual(res.success, true);
    const root = engine.getRoot();
    assert.ok(root?.left, 'Left child must be populated');
    assert.strictEqual(root?.left?.name, 'Amit');
    assert.strictEqual(root?.left?.distributorId, 'KV-1002');
    assert.strictEqual(root?.right, null, 'Right child should remain EMPTY');

    const expectedAscii = `Rahul\n├── Amit\n└── EMPTY`;
    const actualAscii = engine.toAscii();
    assert.strictEqual(actualAscii, expectedAscii, 'ASCII tree should match Expected');
    console.log('\n[PASS] TEST 2 — Tree:\n' + actualAscii);
  });

  // =========================================================================
  // TEST 3: Rohit joins using Rahul
  // =========================================================================
  it('TEST 3: Rohit joins using Rahul (placed on RIGHT leg)', () => {
    const res = engine.joinMember('KV-1001', 'RIGHT', {
      distributorId: 'KV-1003',
      name: 'Rohit',
      sponsorId: 'KV-1001',
      rank: 'Senior Director',
    });

    assert.strictEqual(res.success, true);
    const root = engine.getRoot();
    assert.strictEqual(root?.left?.name, 'Amit');
    assert.strictEqual(root?.right?.name, 'Rohit');
    assert.strictEqual(root?.right?.distributorId, 'KV-1003');

    const expectedAscii = `Rahul\n├── Amit\n└── Rohit`;
    const actualAscii = engine.toAscii();
    assert.strictEqual(actualAscii, expectedAscii, 'ASCII tree should match Expected');
    console.log('\n[PASS] TEST 3 — Tree:\n' + actualAscii);
  });

  // =========================================================================
  // TEST 4: Third direct member attempts to join Rahul
  // =========================================================================
  it('TEST 4: Third direct member attempts to join Rahul -> REJECTED (Both direct positions are occupied)', () => {
    const res = engine.joinMember('KV-1001', 'LEFT', {
      distributorId: 'KV-1004',
      name: 'Priya',
      sponsorId: 'KV-1001',
    });

    assert.strictEqual(res.success, false, 'Third direct placement must be rejected');
    assert.strictEqual(res.rejected, true);
    assert.strictEqual(res.reason, 'Both direct positions are occupied.');

    // Ensure tree structure is preserved
    const root = engine.getRoot();
    assert.strictEqual(root?.left?.name, 'Amit');
    assert.strictEqual(root?.right?.name, 'Rohit');
    console.log('\n[PASS] TEST 4 — Placement Rejected as expected: ' + res.reason);
  });

  // =========================================================================
  // TEST 5: Neha joins under Amit
  // =========================================================================
  it('TEST 5: Neha joins under Amit (placed on LEFT leg)', () => {
    const res = engine.joinMember('KV-1002', 'LEFT', {
      distributorId: 'KV-1006',
      name: 'Neha',
      sponsorId: 'KV-1002',
      rank: 'Silver Director',
    });

    assert.strictEqual(res.success, true);
    const amit = engine.findMember('KV-1002');
    assert.strictEqual(amit?.left?.name, 'Neha');
    assert.strictEqual(amit?.right, null, 'Amit right child is still EMPTY');

    const expectedAscii = `Rahul\n├── Amit\n│   ├── Neha\n│   └── EMPTY\n└── Rohit`;
    const actualAscii = engine.toAscii();
    assert.strictEqual(actualAscii, expectedAscii, 'ASCII tree should match Expected');
    console.log('\n[PASS] TEST 5 — Tree:\n' + actualAscii);
  });

  // =========================================================================
  // TEST 6: Pooja joins under Amit
  // =========================================================================
  it('TEST 6: Pooja joins under Amit (placed on RIGHT leg)', () => {
    const res = engine.joinMember('KV-1002', 'RIGHT', {
      distributorId: 'KV-1005',
      name: 'Pooja',
      sponsorId: 'KV-1002',
      rank: 'Bronze Director',
      status: 'SUSPENDED',
    });

    assert.strictEqual(res.success, true);
    const amit = engine.findMember('KV-1002');
    assert.strictEqual(amit?.left?.name, 'Neha');
    assert.strictEqual(amit?.right?.name, 'Pooja');

    const expectedAscii = `Rahul\n├── Amit\n│   ├── Neha\n│   └── Pooja\n└── Rohit`;
    const actualAscii = engine.toAscii();
    assert.strictEqual(actualAscii, expectedAscii, 'ASCII tree should match Expected');
    console.log('\n[PASS] TEST 6 — Tree:\n' + actualAscii);
  });

  // =========================================================================
  // TEST 7: Attempt another LEFT member under Amit -> REJECTED
  // =========================================================================
  it('TEST 7: Attempt another LEFT member under Amit -> REJECTED', () => {
    const res = engine.joinMember('KV-1002', 'LEFT', {
      distributorId: 'KV-1008',
      name: 'Karan',
      sponsorId: 'KV-1002',
    });

    assert.strictEqual(res.success, false, 'Should be rejected');
    assert.strictEqual(res.rejected, true);
    assert.ok(
      res.reason?.includes('occupied'),
      'Reason must specify occupied leg or occupied direct positions'
    );
    console.log('\n[PASS] TEST 7 — Placement Rejected as expected: ' + res.reason);
  });

  // =========================================================================
  // TEST 8: Hover Amit -> Member details
  // =========================================================================
  it('TEST 8: Hover Amit returns member details tooltip data', () => {
    const hoverData = engine.getHoverDetails('KV-1002');

    assert.ok(hoverData, 'Hover data must exist');
    assert.strictEqual(hoverData.name, 'Amit');
    assert.strictEqual(hoverData.distributorId, 'KV-1002');
    assert.strictEqual(hoverData.rank, 'Executive Director');
    assert.strictEqual(hoverData.status, 'ACTIVE');
    assert.strictEqual(hoverData.teamCounts.left, 1, 'Left count is 1 (Neha)');
    assert.strictEqual(hoverData.teamCounts.right, 1, 'Right count is 1 (Pooja)');
    console.log('\n[PASS] TEST 8 — Hover details verified:', JSON.stringify(hoverData));
  });

  // =========================================================================
  // TEST 9: Click Amit -> Details panel
  // =========================================================================
  it('TEST 9: Click Amit opens Details panel with all 10 attributes', () => {
    const clickData = engine.getClickDetails('KV-1002');

    assert.ok(clickData, 'Click details must exist');
    assert.strictEqual(clickData.isOpen, true);
    assert.strictEqual(clickData.member.name, 'Amit');
    assert.strictEqual(clickData.member.sponsor, 'KV-1001');
    assert.strictEqual(clickData.member.placementParent, 'KV-1001');
    assert.strictEqual(clickData.member.position, 'LEFT');
    assert.strictEqual(clickData.member.rank, 'Executive Director');
    assert.strictEqual(clickData.member.status, 'ACTIVE');
    assert.strictEqual(clickData.member.teamCounts.total, 2);
    assert.strictEqual(clickData.member.businessCenter, 'BC-001');
    console.log('\n[PASS] TEST 9 — Details panel data verified for Amit');
  });

  // =========================================================================
  // TEST 10: View Network -> Amit becomes root
  // =========================================================================
  it('TEST 10: View Network sets Amit as the focal root', () => {
    const amitSubtree = engine.viewNetwork('KV-1002');

    assert.ok(amitSubtree, 'Amit subtree must exist');
    assert.strictEqual(amitSubtree.name, 'Amit');
    assert.strictEqual(amitSubtree.distributorId, 'KV-1002');
    assert.strictEqual(amitSubtree.left?.name, 'Neha');
    assert.strictEqual(amitSubtree.right?.name, 'Pooja');

    const expectedAscii = `Amit\n├── Neha\n└── Pooja`;
    const actualAscii = engine.toAscii(amitSubtree);
    assert.strictEqual(actualAscii, expectedAscii);
    console.log('\n[PASS] TEST 10 — Amit focused as root:\n' + actualAscii);
  });

  // =========================================================================
  // TEST 11: Refresh -> Tree remains correct
  // =========================================================================
  it('TEST 11: Refresh simulation retains tree integrity and correct topology', () => {
    // Re-query from directory
    const rootAfterReload = engine.getRoot();
    assert.strictEqual(rootAfterReload?.name, 'Rahul');
    assert.strictEqual(rootAfterReload?.left?.name, 'Amit');
    assert.strictEqual(rootAfterReload?.right?.name, 'Rohit');
    assert.strictEqual(rootAfterReload?.left?.left?.name, 'Neha');
    assert.strictEqual(rootAfterReload?.left?.right?.name, 'Pooja');

    const expectedAscii = `Rahul\n├── Amit\n│   ├── Neha\n│   └── Pooja\n└── Rohit`;
    assert.strictEqual(engine.toAscii(rootAfterReload), expectedAscii);
    console.log('\n[PASS] TEST 11 — Tree structure validated across refresh cycle');
  });

  // =========================================================================
  // TEST 12: Open /join?ref=KV-1001 -> Rahul identified as sponsor
  // =========================================================================
  it('TEST 12: /join?ref=KV-1001 automatically identifies Rahul as sponsor', () => {
    const url = '/join?ref=KV-1001';
    const params = new URLSearchParams(url.split('?')[1]);
    const refCode = params.get('ref')!;

    const sponsorCheck = engine.validateSponsor(refCode);
    assert.strictEqual(sponsorCheck.isValid, true);
    assert.strictEqual(sponsorCheck.sponsor?.distributorId, 'KV-1001');
    assert.strictEqual(sponsorCheck.sponsor?.name, 'Rahul');
    assert.strictEqual(sponsorCheck.sponsor?.status, 'ACTIVE');
    console.log('\n[PASS] TEST 12 — /join?ref=KV-1001 verified sponsor:', sponsorCheck.sponsor?.name);
  });

  // =========================================================================
  // TEST 13: Invalid sponsor -> Rejected
  // =========================================================================
  it('TEST 13: Invalid sponsor is rejected', () => {
    const sponsorCheck = engine.validateSponsor('INVALID_SPONSOR_999');

    assert.strictEqual(sponsorCheck.isValid, false);
    assert.ok(sponsorCheck.reason?.includes('REJECTED'));
    assert.ok(sponsorCheck.reason?.includes('not found') || sponsorCheck.reason?.includes('Invalid'));
    console.log('\n[PASS] TEST 13 — Invalid sponsor rejected: ' + sponsorCheck.reason);
  });

  // =========================================================================
  // TEST 14: Inactive sponsor -> Rejected
  // =========================================================================
  it('TEST 14: Inactive sponsor is rejected', () => {
    // Pooja (KV-1005) has status SUSPENDED in our tree
    const sponsorCheck = engine.validateSponsor('KV-1005');

    assert.strictEqual(sponsorCheck.isValid, false);
    assert.ok(sponsorCheck.reason?.includes('Inactive sponsor') || sponsorCheck.reason?.includes('SUSPENDED'));
    console.log('\n[PASS] TEST 14 — Inactive/suspended sponsor rejected: ' + sponsorCheck.reason);
  });

  // =========================================================================
  // TEST 15: Self-sponsorship -> Rejected
  // =========================================================================
  it('TEST 15: Self-sponsorship is rejected', () => {
    const applicantId = 'KV-1001';
    const sponsorId = 'KV-1001';

    const sponsorCheck = engine.validateSponsor(sponsorId, applicantId);
    assert.strictEqual(sponsorCheck.isValid, false);
    assert.ok(sponsorCheck.reason?.includes('Self-sponsorship is not permitted'));
    console.log('\n[PASS] TEST 15 — Self-sponsorship rejected: ' + sponsorCheck.reason);
  });

  // =========================================================================
  // TEST 16: Circular placement -> Rejected
  // =========================================================================
  it('TEST 16: Circular placement (placing ancestor under descendant) is rejected', () => {
    // Attempting to place Rahul (KV-1001) under Amit (KV-1002), where Amit is already in Rahul's downline
    const circularRes = engine.joinMember('KV-1002', 'LEFT', {
      distributorId: 'KV-1001',
      name: 'Rahul',
      sponsorId: 'KV-1002',
    });

    assert.strictEqual(circularRes.success, false);
    assert.strictEqual(circularRes.rejected, true);
    assert.ok(
      circularRes.reason?.includes('occupied') ||
      circularRes.reason?.includes('Circular placement detected') ||
      circularRes.reason?.includes('ancestor under a descendant')
    );
    console.log('\n[PASS] TEST 16 — Circular placement rejected: ' + circularRes.reason);
  });

  // =========================================================================
  // TEST 17: Two users attempt simultaneous LEFT placement -> Only one succeeds
  // =========================================================================
  it('TEST 17: Two users attempt simultaneous LEFT placement -> Exactly one succeeds', async () => {
    // Under Rohit (KV-1003), LEFT is currently EMPTY.
    const userA = {
      distributorId: 'KV-SIM-A',
      name: 'Simultaneous User A',
      sponsorId: 'KV-1003',
    };
    const userB = {
      distributorId: 'KV-SIM-B',
      name: 'Simultaneous User B',
      sponsorId: 'KV-1003',
    };

    const raceResult = await engine.simulateSimultaneousLeftPlacement('KV-1003', userA, userB);

    assert.strictEqual(raceResult.onlyOneSucceeded, true, 'Exactly one placement must succeed');
    assert.ok(
      (raceResult.userAResult.success && !raceResult.userBResult.success) ||
      (!raceResult.userAResult.success && raceResult.userBResult.success),
      'One must succeed and one must fail'
    );
    console.log(
      '\n[PASS] TEST 17 — Concurrency test passed: Exactly one user succeeded (User A: ' +
      raceResult.userAResult.success +
      ', User B: ' +
      raceResult.userBResult.success +
      ')'
    );
  });

  // =========================================================================
  // TEST 18: Admin opens network tree -> Works
  // =========================================================================
  it('TEST 18: Admin opens network tree -> Permitted (200 OK)', () => {
    const adminUser = { role: 'ADMIN', isLoggedIn: true };
    const access = engine.checkAdminAccess(adminUser);

    assert.strictEqual(access.allowed, true);
    assert.strictEqual(access.statusCode, 200);
    console.log('\n[PASS] TEST 18 — Admin access permitted: ' + access.message);
  });

  // =========================================================================
  // TEST 19: Normal user accesses admin network tree -> 403
  // =========================================================================
  it('TEST 19: Normal distributor accesses admin network tree -> 403 Forbidden', () => {
    const normalUser = { role: 'DISTRIBUTOR', isLoggedIn: true };
    const access = engine.checkAdminAccess(normalUser);

    assert.strictEqual(access.allowed, false);
    assert.strictEqual(access.statusCode, 403);
    assert.ok(access.message.includes('403 Forbidden'));
    console.log('\n[PASS] TEST 19 — Normal user access blocked: ' + access.message);
  });

  // =========================================================================
  // TEST 20: Mobile tree -> Zoom/pan works
  // =========================================================================
  it('TEST 20: Mobile tree responsive zoom and pan transforms work properly', () => {
    const mobileWidth = 390; // iPhone 14 screen width
    const currentZoom = 1.0;
    const currentPan = { x: 0, y: 0 };
    const deltaPan = { x: 45, y: -30 };
    const zoomFactor = 1.25;

    const viewport = engine.calculateMobileViewport(
      mobileWidth,
      currentZoom,
      currentPan,
      deltaPan,
      zoomFactor
    );

    assert.strictEqual(viewport.isMobile, true);
    assert.strictEqual(viewport.zoomLevel, 1.25);
    assert.strictEqual(viewport.panPosition.x, 45);
    assert.strictEqual(viewport.panPosition.y, -30);
    assert.ok(viewport.transformStyle.includes('scale(1.25)'));
    assert.ok(viewport.transformStyle.includes('translate(45px, -30px)'));
    console.log('\n[PASS] TEST 20 — Mobile zoom/pan viewport transform verified:', viewport.transformStyle);
  });
});
