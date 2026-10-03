import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { app } from '../../app.js';
import { BinaryTreeService } from './binaryTree.service.js';

describe('PROMPT 4 — BINARY MLM TREE RETRIEVAL, DOWNLINE AND NETWORK CALCULATIONS (17 TESTS)', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        console.log(`[Prompt 4 Test Server] Running at ${baseUrl}`);
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

  // =========================================================================
  // TEST 1: Get root tree
  // =========================================================================
  it('TEST 1: Get root tree retrieves complete hierarchy starting at root (KV-1001)', async () => {
    // 1. Service retrieval
    const tree = await BinaryTreeService.getTree('KV-1001', 3);
    assert.strictEqual(tree.distributorId, 'KV-1001');
    assert.strictEqual(tree.level, 0);
    assert.ok(tree.left, 'Root must have LEFT child');
    assert.ok(tree.right, 'Root must have RIGHT child');
    assert.strictEqual(tree.left.distributorId, 'KV-1002');
    assert.strictEqual(tree.right.distributorId, 'KV-1003');

    // 2. REST API retrieval
    const res = await fetch(`${baseUrl}/api/tree/KV-1001?depth=3`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.distributorId, 'KV-1001');
    assert.strictEqual(body.data.left.distributorId, 'KV-1002');
    assert.strictEqual(body.data.right.distributorId, 'KV-1003');
    console.log('[PASS] TEST 1: Root tree retrieved successfully with Left and Right branches');
  });

  // =========================================================================
  // TEST 2: Get direct children
  // =========================================================================
  it('TEST 2: Get direct children returns clearly identified LEFT and RIGHT children', async () => {
    // 1. Service
    const children = await BinaryTreeService.getDirectChildren('KV-1001');
    assert.strictEqual(children.distributorId, 'KV-1001');
    assert.ok(children.left);
    assert.ok(children.right);
    assert.strictEqual(children.left.distributorId, 'KV-1002');
    assert.strictEqual(children.left.position, 'LEFT');
    assert.strictEqual(children.right.distributorId, 'KV-1003');
    assert.strictEqual(children.right.position, 'RIGHT');

    // 2. REST API
    const res = await fetch(`${baseUrl}/api/tree/KV-1001/children`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.distributorId, 'KV-1001');
    assert.strictEqual(body.data.left.distributorId, 'KV-1002');
    assert.strictEqual(body.data.right.distributorId, 'KV-1003');
    console.log('[PASS] TEST 2: Direct children returned LEFT = KV-1002 and RIGHT = KV-1003');
  });

  // =========================================================================
  // TEST 3: Get complete downline
  // =========================================================================
  it('TEST 3: Get complete downline returns all descendants excluding distributor itself', async () => {
    // 1. Service
    const downlineResult = await BinaryTreeService.getDownline('KV-1001');
    const memberIds = downlineResult.data.map((d: any) => d.distributorId);

    // Downline of KV-1001 should contain B, C, D, E, F, G, H, I
    const expected = ['KV-1002', 'KV-1003', 'KV-1004', 'KV-1005', 'KV-1006', 'KV-1007', 'KV-1008', 'KV-1009'];
    for (const exp of expected) {
      assert.ok(memberIds.includes(exp), `Downline must include descendant ${exp}`);
    }
    // Must NOT contain self
    assert.strictEqual(memberIds.includes('KV-1001'), false, 'Downline must not include root distributor itself');
    assert.strictEqual(downlineResult.total, expected.length);

    // 2. REST API
    const res = await fetch(`${baseUrl}/api/tree/KV-1001/downline`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.total, expected.length);
    console.log(`[PASS] TEST 3: Complete downline contains all ${downlineResult.total} descendants`);
  });

  // =========================================================================
  // TEST 4: Get LEFT team
  // =========================================================================
  it('TEST 4: Get LEFT team returns only descendants in the LEFT subtree', async () => {
    // 1. Service
    const leftDownline = await BinaryTreeService.getLeftDownline('KV-1001');
    const memberIds = leftDownline.data.map((d: any) => d.distributorId);

    // Left team of KV-1001: KV-1002, KV-1004, KV-1005, KV-1008, KV-1009
    const expectedLeft = ['KV-1002', 'KV-1004', 'KV-1005', 'KV-1008', 'KV-1009'];
    for (const exp of expectedLeft) {
      assert.ok(memberIds.includes(exp), `LEFT team must include ${exp}`);
    }

    // Must NOT include right subtree members (KV-1003, KV-1006, KV-1007)
    assert.strictEqual(memberIds.includes('KV-1003'), false, 'LEFT team must not include KV-1003');
    assert.strictEqual(memberIds.includes('KV-1006'), false, 'LEFT team must not include KV-1006');
    assert.strictEqual(memberIds.includes('KV-1007'), false, 'LEFT team must not include KV-1007');
    assert.strictEqual(memberIds.includes('KV-1001'), false, 'LEFT team must not include self');

    // 2. REST API
    const res = await fetch(`${baseUrl}/api/tree/KV-1001/left`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.total, 5);
    console.log('[PASS] TEST 4: LEFT team correctly isolated to 5 left-leg descendants');
  });

  // =========================================================================
  // TEST 5: Get RIGHT team
  // =========================================================================
  it('TEST 5: Get RIGHT team returns only descendants in the RIGHT subtree', async () => {
    // 1. Service
    const rightDownline = await BinaryTreeService.getRightDownline('KV-1001');
    const memberIds = rightDownline.data.map((d: any) => d.distributorId);

    // Right team of KV-1001: KV-1003, KV-1006, KV-1007
    const expectedRight = ['KV-1003', 'KV-1006', 'KV-1007'];
    for (const exp of expectedRight) {
      assert.ok(memberIds.includes(exp), `RIGHT team must include ${exp}`);
    }

    // Must NOT include left subtree members
    assert.strictEqual(memberIds.includes('KV-1002'), false, 'RIGHT team must not include KV-1002');
    assert.strictEqual(memberIds.includes('KV-1004'), false, 'RIGHT team must not include KV-1004');
    assert.strictEqual(memberIds.includes('KV-1001'), false, 'RIGHT team must not include self');

    // 2. REST API
    const res = await fetch(`${baseUrl}/api/tree/KV-1001/right`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.total, 3);
    console.log('[PASS] TEST 5: RIGHT team correctly isolated to 3 right-leg descendants');
  });

  // =========================================================================
  // TEST 6: Calculate total downline
  // =========================================================================
  it('TEST 6: Calculate total downline count accurately across levels', async () => {
    // KV-1001: 8 descendants
    const statsA = await BinaryTreeService.getNetworkStatistics('KV-1001');
    assert.strictEqual(statsA.totalDownline, 8, 'Root A total downline must be 8');

    // KV-1002 (B): 4 descendants (D, E, H, I)
    const statsB = await BinaryTreeService.getNetworkStatistics('KV-1002');
    assert.strictEqual(statsB.totalDownline, 4, 'B total downline must be 4');

    // KV-1003 (C): 2 descendants (F, G)
    const statsC = await BinaryTreeService.getNetworkStatistics('KV-1003');
    assert.strictEqual(statsC.totalDownline, 2, 'C total downline must be 2');

    // KV-1004 (D): 2 descendants (H, I)
    const statsD = await BinaryTreeService.getNetworkStatistics('KV-1004');
    assert.strictEqual(statsD.totalDownline, 2, 'D total downline must be 2');

    // KV-1008 (H): leaf node -> 0
    const statsH = await BinaryTreeService.getNetworkStatistics('KV-1008');
    assert.strictEqual(statsH.totalDownline, 0, 'Leaf H total downline must be 0');

    // REST API check
    const res = await fetch(`${baseUrl}/api/tree/KV-1001/statistics`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.data.totalDownline, 8);
    console.log('[PASS] TEST 6: Total downline counts calculated accurately (A=8, B=4, C=2, D=2, H=0)');
  });

  // =========================================================================
  // TEST 7: Calculate LEFT team count
  // =========================================================================
  it('TEST 7: Calculate LEFT team count accurately', async () => {
    // For A (KV-1001): LEFT team = 5 (B, D, E, H, I)
    const statsA = await BinaryTreeService.getNetworkStatistics('KV-1001');
    assert.strictEqual(statsA.leftTeam, 5, 'A left team count must be 5');

    // For B (KV-1002): LEFT team = 3 (D, H, I)
    const statsB = await BinaryTreeService.getNetworkStatistics('KV-1002');
    assert.strictEqual(statsB.leftTeam, 3, 'B left team count must be 3');

    // For C (KV-1003): LEFT team = 1 (F)
    const statsC = await BinaryTreeService.getNetworkStatistics('KV-1003');
    assert.strictEqual(statsC.leftTeam, 1, 'C left team count must be 1');

    console.log('[PASS] TEST 7: LEFT team counts verified (A=5, B=3, C=1)');
  });

  // =========================================================================
  // TEST 8: Calculate RIGHT team count
  // =========================================================================
  it('TEST 8: Calculate RIGHT team count accurately', async () => {
    // For A (KV-1001): RIGHT team = 3 (C, F, G)
    const statsA = await BinaryTreeService.getNetworkStatistics('KV-1001');
    assert.strictEqual(statsA.rightTeam, 3, 'A right team count must be 3');

    // For B (KV-1002): RIGHT team = 1 (E)
    const statsB = await BinaryTreeService.getNetworkStatistics('KV-1002');
    assert.strictEqual(statsB.rightTeam, 1, 'B right team count must be 1');

    // For C (KV-1003): RIGHT team = 1 (G)
    const statsC = await BinaryTreeService.getNetworkStatistics('KV-1003');
    assert.strictEqual(statsC.rightTeam, 1, 'C right team count must be 1');

    console.log('[PASS] TEST 8: RIGHT team counts verified (A=3, B=1, C=1)');
  });

  // =========================================================================
  // TEST 9: Calculate distributor level
  // =========================================================================
  it('TEST 9: Calculate distributor level dynamically (Root=0, Children=1, Grandchildren=2, Great-grandchildren=3)', async () => {
    // Level 0: Root A
    const lvlA = await BinaryTreeService.getDistributorLevel('KV-1001');
    assert.strictEqual(lvlA.level, 0, 'Root level must be 0');

    // Level 1: B & C
    const lvlB = await BinaryTreeService.getDistributorLevel('KV-1002');
    assert.strictEqual(lvlB.level, 1, 'B level must be 1');
    const lvlC = await BinaryTreeService.getDistributorLevel('KV-1003');
    assert.strictEqual(lvlC.level, 1, 'C level must be 1');

    // Level 2: D, E, F, G
    const lvlD = await BinaryTreeService.getDistributorLevel('KV-1004');
    assert.strictEqual(lvlD.level, 2, 'D level must be 2');

    // Level 3: H, I
    const lvlH = await BinaryTreeService.getDistributorLevel('KV-1008');
    assert.strictEqual(lvlH.level, 3, 'H level must be 3');
    const lvlI = await BinaryTreeService.getDistributorLevel('KV-1009');
    assert.strictEqual(lvlI.level, 3, 'I level must be 3');

    // REST API
    const res = await fetch(`${baseUrl}/api/tree/KV-1008/level`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.data.level, 3);

    console.log('[PASS] TEST 9: Tree levels calculated correctly (A=0, B=1, C=1, D=2, H=3, I=3)');
  });

  // =========================================================================
  // TEST 10: Retrieve ancestors
  // =========================================================================
  it('TEST 10: Retrieve ancestors returns ordered list from root to immediate parent', async () => {
    // For H (KV-1008): Ancestors must be A (KV-1001) -> B (KV-1002) -> D (KV-1004)
    const ancestors = await BinaryTreeService.getAncestors('KV-1008');
    assert.strictEqual(ancestors.length, 3, 'H must have exactly 3 ancestors');
    assert.strictEqual(ancestors[0].distributorId, 'KV-1001', 'Root A must be first ancestor');
    assert.strictEqual(ancestors[0].level, 0);
    assert.strictEqual(ancestors[1].distributorId, 'KV-1002', 'B must be second ancestor');
    assert.strictEqual(ancestors[1].level, 1);
    assert.strictEqual(ancestors[2].distributorId, 'KV-1004', 'Immediate parent D must be third ancestor');
    assert.strictEqual(ancestors[2].level, 2);

    // REST API
    const res = await fetch(`${baseUrl}/api/tree/KV-1008/ancestors`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 3);
    assert.strictEqual(body.data[0].distributorId, 'KV-1001');
    assert.strictEqual(body.data[2].distributorId, 'KV-1004');
    console.log('[PASS] TEST 10: Ancestors returned in chronological order: [KV-1001, KV-1002, KV-1004]');
  });

  // =========================================================================
  // TEST 11: Retrieve path from root
  // =========================================================================
  it('TEST 11: Retrieve path from root with positions (A -> LEFT -> B -> LEFT -> D -> LEFT -> H)', async () => {
    // 1. Service
    const pathResult = await BinaryTreeService.getPath('KV-1008');
    assert.strictEqual(pathResult.distributorId, 'KV-1008');
    assert.strictEqual(pathResult.path.length, 4, 'Path to H must have 4 nodes');
    assert.strictEqual(pathResult.path[0].distributorId, 'KV-1001');
    assert.strictEqual(pathResult.path[1].distributorId, 'KV-1002');
    assert.strictEqual(pathResult.path[2].distributorId, 'KV-1004');
    assert.strictEqual(pathResult.path[3].distributorId, 'KV-1008');

    assert.strictEqual(pathResult.formattedPath, 'KV-1001 → KV-1002 → KV-1004 → KV-1008');

    // Transitions
    assert.strictEqual(pathResult.steps.length, 3);
    assert.strictEqual(pathResult.steps[0].position, 'LEFT');
    assert.strictEqual(pathResult.steps[1].position, 'LEFT');
    assert.strictEqual(pathResult.steps[2].position, 'LEFT');

    // 2. REST API
    const res = await fetch(`${baseUrl}/api/tree/KV-1008/path`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.formattedPath, 'KV-1001 → KV-1002 → KV-1004 → KV-1008');
    console.log(`[PASS] TEST 11: Path verified: ${pathResult.formattedPath}`);
  });

  // =========================================================================
  // TEST 12: Request non-existing distributor (404)
  // =========================================================================
  it('TEST 12: Request non-existing distributor returns 404 with standard error format', async () => {
    // Service rejects
    await assert.rejects(
      async () => {
        await BinaryTreeService.getTree('INVALID_DISTRIBUTOR_9999');
      },
      (err: any) => {
        assert.ok(err.message.includes('not found') || err.statusCode === 404);
        return true;
      }
    );

    // REST API returns 404
    const res = await fetch(`${baseUrl}/api/tree/INVALID_DISTRIBUTOR_9999`);
    assert.strictEqual(res.status, 404);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('not found'));
    console.log('[PASS] TEST 12: Non-existing distributor returned 404: ' + body.message);
  });

  // =========================================================================
  // TEST 13: Depth limitation
  // =========================================================================
  it('TEST 13: Depth limitation restricts tree expansion to requested depth', async () => {
    // Depth = 1: Root + direct children only
    const treeDepth1 = await BinaryTreeService.getTree('KV-1001', 1);
    assert.strictEqual(treeDepth1.distributorId, 'KV-1001');
    assert.ok(treeDepth1.left);
    assert.ok(treeDepth1.right);
    // Depth 1 means children are leaf nodes in the returned tree (left.left is null)
    assert.strictEqual(treeDepth1.left.left, null, 'Level 2 left child must not be expanded at depth=1');
    assert.strictEqual(treeDepth1.left.right, null, 'Level 2 right child must not be expanded at depth=1');

    // Depth = 2: Level 2 grandchildren are expanded, but Level 3 great-grandchildren are null
    const treeDepth2 = await BinaryTreeService.getTree('KV-1001', 2);
    assert.ok(treeDepth2.left?.left); // KV-1004 is present
    assert.strictEqual(treeDepth2.left?.left?.left, null, 'Level 3 must not be expanded at depth=2');

    // REST API with ?depth=1
    const res = await fetch(`${baseUrl}/api/tree/KV-1001?depth=1`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.data.left.left, null);
    console.log('[PASS] TEST 13: Depth limitation strictly enforced for depth=1 and depth=2');
  });

  // =========================================================================
  // TEST 14: Pagination
  // =========================================================================
  it('TEST 14: Pagination returns bounded pages of downline with metadata', async () => {
    // Request page 1 with limit 2
    const page1 = await BinaryTreeService.getDownline('KV-1001', { page: 1, limit: 2 });
    assert.strictEqual(page1.page, 1);
    assert.strictEqual(page1.limit, 2);
    assert.strictEqual(page1.data.length, 2);
    assert.strictEqual(page1.total, 8);
    assert.strictEqual(page1.totalPages, 4);

    // Request page 2 with limit 2
    const page2 = await BinaryTreeService.getDownline('KV-1001', { page: 2, limit: 2 });
    assert.strictEqual(page2.page, 2);
    assert.strictEqual(page2.data.length, 2);
    assert.notStrictEqual(page1.data[0].distributorId, page2.data[0].distributorId, 'Pages must contain distinct members');

    // REST API
    const res = await fetch(`${baseUrl}/api/tree/KV-1001/downline?page=1&limit=2`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.data.page, 1);
    assert.strictEqual(body.data.limit, 2);
    assert.strictEqual(body.data.data.length, 2);
    assert.strictEqual(body.data.total, 8);
    assert.strictEqual(body.data.totalPages, 4);
    console.log('[PASS] TEST 14: Pagination verified with total 8 across 4 pages of limit 2');
  });

  // =========================================================================
  // TEST 15: Sponsor vs parent separation
  // =========================================================================
  it('TEST 15: Sponsor vs parent separation guarantees sponsorId !== parentId where applicable', async () => {
    // Harsh (KV-1008): sponsored by KV-1001 (Rahul), but tree parent is KV-1004 (Priya)
    const sponsor = await BinaryTreeService.getSponsor('KV-1008');
    const parent = await BinaryTreeService.getParent('KV-1008');

    assert.ok(sponsor);
    assert.ok(parent);
    assert.strictEqual(sponsor.memberId, 'KV-1001', 'Sponsor must be Rahul (KV-1001)');
    assert.strictEqual(parent.memberId, 'KV-1004', 'Tree parent must be Priya (KV-1004)');
    assert.notStrictEqual(sponsor.memberId, parent.memberId, 'Sponsor and parent must remain strictly separate');

    // REST API endpoints
    const resSponsor = await fetch(`${baseUrl}/api/tree/KV-1008/sponsor`);
    assert.strictEqual(resSponsor.status, 200);
    const sponsorBody: any = await resSponsor.json();
    assert.strictEqual(sponsorBody.data.memberId, 'KV-1001');

    const resParent = await fetch(`${baseUrl}/api/tree/KV-1008/parent`);
    assert.strictEqual(resParent.status, 200);
    const parentBody: any = await resParent.json();
    assert.strictEqual(parentBody.data.memberId, 'KV-1004');

    console.log(`[PASS] TEST 15: Sponsor (${sponsor.memberId}) !== Parent (${parent.memberId}) strictly distinguished`);
  });

  // =========================================================================
  // TEST 16: Tree integrity validation
  // =========================================================================
  it('TEST 16: Tree integrity validation passes with no duplicate slots, invalid positions, or cycles', async () => {
    const report = await BinaryTreeService.validateTreeIntegrity();
    assert.ok(report);
    assert.strictEqual(report.valid, true, 'Tree must be valid');
    assert.strictEqual(report.errors.length, 0, 'No tree integrity errors should be present');
    assert.ok(report.totalNodes >= 7, 'Total nodes must reflect seed network');

    // REST API
    const res = await fetch(`${baseUrl}/api/tree/validate/integrity`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    console.log(`[PASS] TEST 16: Tree integrity passed with ${report.totalNodes} validated nodes`);
  });

  // =========================================================================
  // TEST 17: Unrelated network search isolation
  // =========================================================================
  it('TEST 17: Search within downline strictly isolates results to distributors own team', async () => {
    // Searching under C (KV-1003) for 'Priya' (KV-1004) -> Priya is under B (KV-1002), NOT under C!
    const searchUnderC = await BinaryTreeService.searchDownline('KV-1003', 'Priya');
    assert.strictEqual(searchUnderC.total, 0, 'Priya must NOT be found in KV-1003 downline');
    assert.strictEqual(searchUnderC.data.length, 0);

    // Searching under B (KV-1002) for 'Priya' -> MUST be found!
    const searchUnderB = await BinaryTreeService.searchDownline('KV-1002', 'Priya');
    assert.strictEqual(searchUnderB.total, 1, 'Priya MUST be found in KV-1002 downline');
    assert.strictEqual(searchUnderB.data[0].distributorId, 'KV-1004');

    // REST API search under KV-1003 for Priya
    const resC = await fetch(`${baseUrl}/api/tree/KV-1003/search?query=Priya`);
    assert.strictEqual(resC.status, 200);
    const bodyC: any = await resC.json();
    assert.strictEqual(bodyC.data.total, 0);

    // REST API search under KV-1002 for Priya
    const resB = await fetch(`${baseUrl}/api/tree/KV-1002/search?query=Priya`);
    assert.strictEqual(resB.status, 200);
    const bodyB: any = await resB.json();
    assert.strictEqual(bodyB.data.total, 1);
    assert.strictEqual(bodyB.data.data[0].distributorId, 'KV-1004');

    console.log('[PASS] TEST 17: Unrelated network search isolation strictly verified');
  });
});
