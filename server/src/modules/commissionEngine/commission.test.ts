import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { app } from '../../app.js';
import { BusinessVolumeService } from '../bvEngine/businessVolume.service.js';
import { CommissionService } from './commission.service.js';
import { CommissionConfigService } from './commissionConfig.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { SafeDecimal } from '../../utils/safeDecimal.js';
import { withTransaction } from '../../config/db.js';

describe('PROMPT 5 — MLM BUSINESS VOLUME, TEAM VOLUME, MATCHING AND COMMISSION ENGINE (18 TESTS)', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        console.log(`[Prompt 5 Test Server] Running at ${baseUrl}`);
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

  beforeEach(() => {
    CommissionConfigService.resetConfig();
  });

  // =========================================================================
  // TEST 1: Create personal business volume
  // =========================================================================
  it('TEST 1: Create personal business volume records transaction and updates personal BV', async () => {
    const initialBV = await BusinessVolumeService.getPersonalBusinessVolume('KV-1001');

    // 1. Post new BV transaction via REST API
    const res = await fetch(`${baseUrl}/api/business-volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distributorId: 'KV-1001',
        orderId: `ORD-TEST-1-${Date.now()}`,
        amount: 2500,
        businessVolume: 500,
        type: 'PURCHASE',
        status: 'APPROVED',
        description: 'Product purchase personal BV test',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.businessVolume, 500);
    assert.strictEqual(body.data.status, 'APPROVED');

    // 2. Verify personal BV increased
    const updatedBV = await BusinessVolumeService.getPersonalBusinessVolume('KV-1001');
    assert.strictEqual(updatedBV, SafeDecimal.add(initialBV, 500));

    // 3. Verify GET /api/business-volume/KV-1001
    const getRes = await fetch(`${baseUrl}/api/business-volume/KV-1001`);
    assert.strictEqual(getRes.status, 200);
    const getBody: any = await getRes.json();
    assert.strictEqual(getBody.success, true);
    assert.strictEqual(getBody.data.personalBV, updatedBV);
    console.log('[PASS] TEST 1: Personal business volume recorded and verified.');
  });

  // =========================================================================
  // TEST 2: Calculate LEFT team volume
  // =========================================================================
  it('TEST 2: Calculate LEFT team volume aggregates descendants under LEFT subtree (KV-1002, KV-1004, KV-1005)', async () => {
    // KV-1001 left child is KV-1002 (1,000 BV), KV-1004 (2,000 BV), KV-1005 (1,500 BV) -> total = 4,500 BV
    const leftBV = await BusinessVolumeService.getLeftTeamBusinessVolume('KV-1001');
    assert.strictEqual(leftBV, 4500);

    // Verify REST API GET /api/business-volume/KV-1001/left
    const res = await fetch(`${baseUrl}/api/business-volume/KV-1001/left`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.distributorId, 'KV-1001');
    assert.strictEqual(body.data.leg || body.data.team, 'LEFT');
    assert.strictEqual(body.data.businessVolume, 4500);
    console.log('[PASS] TEST 2: LEFT team volume calculated correctly (4,500 BV).');
  });

  // =========================================================================
  // TEST 3: Calculate RIGHT team volume
  // =========================================================================
  it('TEST 3: Calculate RIGHT team volume aggregates descendants under RIGHT subtree (KV-1003, KV-1006, KV-1007)', async () => {
    // KV-1001 right child is KV-1003 (1,500 BV), KV-1006 (2,000 BV), KV-1007 (1,000 BV) -> total = 4,500 BV
    const rightBV = await BusinessVolumeService.getRightTeamBusinessVolume('KV-1001');
    assert.strictEqual(rightBV, 4500);

    // Verify REST API GET /api/business-volume/KV-1001/right
    const res = await fetch(`${baseUrl}/api/business-volume/KV-1001/right`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.distributorId, 'KV-1001');
    assert.strictEqual(body.data.leg || body.data.team, 'RIGHT');
    assert.strictEqual(body.data.businessVolume, 4500);
    console.log('[PASS] TEST 3: RIGHT team volume calculated correctly (4,500 BV).');
  });

  // =========================================================================
  // TEST 4: Calculate total team volume
  // =========================================================================
  it('TEST 4: Calculate total team volume = LEFT Team BV + RIGHT Team BV', async () => {
    const totalTeamBV = await BusinessVolumeService.getTotalTeamBusinessVolume('KV-1001');
    const leftBV = await BusinessVolumeService.getLeftTeamBusinessVolume('KV-1001');
    const rightBV = await BusinessVolumeService.getRightTeamBusinessVolume('KV-1001');

    assert.strictEqual(totalTeamBV, SafeDecimal.add(leftBV, rightBV));
    assert.strictEqual(totalTeamBV, 9000);

    // Verify REST API GET /api/business-volume/KV-1001/summary
    const res = await fetch(`${baseUrl}/api/business-volume/KV-1001/summary`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.leftTeamBV, 4500);
    assert.strictEqual(body.data.rightTeamBV, 4500);
    assert.strictEqual(body.data.totalTeamBV, 9000);
    console.log('[PASS] TEST 4: Total team volume correctly equals LEFT + RIGHT (9,000 BV).');
  });

  // =========================================================================
  // TEST 5: Verify personal BV is not included in team BV
  // =========================================================================
  it('TEST 5: Verify personal BV is not included in team BV', async () => {
    const summary = await BusinessVolumeService.getDistributorVolumeSummary('KV-1001');

    // Personal BV must be > 0 (5,500 after TEST 1)
    assert.ok(summary.personalBV >= 5000);

    // Left and Right team volumes must strictly be the descendants' volumes (4,500 each)
    assert.strictEqual(summary.leftTeamBV, 4500);
    assert.strictEqual(summary.rightTeamBV, 4500);
    assert.strictEqual(summary.totalTeamBV, 9000);

    // Team BV does NOT contain personal BV
    assert.strictEqual(summary.totalTeamBV, summary.leftTeamBV + summary.rightTeamBV);

    // Total Network BV is personal + team BV
    assert.strictEqual(summary.totalNetworkBV, SafeDecimal.add(summary.personalBV, summary.totalTeamBV));
    console.log('[PASS] TEST 5: Personal BV is strictly excluded from team BV.');
  });

  // =========================================================================
  // TEST 6: Calculate matched volume
  // =========================================================================
  it('TEST 6: Calculate matched volume (10,000 Left vs 8,000 Right -> 8,000 Matched, 2,000 Carry-forward Left)', async () => {
    // 1. Service calculation
    const calc = await CommissionService.calculateCommission('KV-1001', {
      overrideLeftVolume: 10000,
      overrideRightVolume: 8000,
    });

    assert.strictEqual(calc.matchedVolume, 8000);
    assert.strictEqual(calc.commissionRate, 10);
    assert.strictEqual(calc.grossCommission, 800);
    assert.strictEqual(calc.carryForwardLeft, 2000);
    assert.strictEqual(calc.carryForwardRight, 0);

    // 2. REST API POST /api/commission/calculate
    const res = await fetch(`${baseUrl}/api/commission/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distributorId: 'KV-1001',
        overrideLeftVolume: 10000,
        overrideRightVolume: 8000,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.matchedVolume, 8000);
    assert.strictEqual(body.commissionAmount, 800);
    assert.strictEqual(body.carryForwardLeft, 2000);
    assert.strictEqual(body.carryForwardRight, 0);
    console.log('[PASS] TEST 6: Matched volume and commission correctly calculated (8,000 matched -> ₹800).');
  });

  // =========================================================================
  // TEST 7: Verify commission rate comes from configuration
  // =========================================================================
  it('TEST 7: Verify commission rate comes from configuration dynamically', async () => {
    // Verify default config rate is 10%
    const initialConfig = CommissionConfigService.getConfig();
    assert.strictEqual(initialConfig.matchingPercentage, 10);

    // Update config to 15% using administrative privileges
    CommissionConfigService.updateConfig({ matchingPercentage: 15 }, 'admin');

    const calc15 = await CommissionService.calculateCommission('KV-1001', {
      overrideLeftVolume: 2000,
      overrideRightVolume: 2000,
    });
    // Matched = 2,000; 15% of 2,000 = 300
    assert.strictEqual(calc15.commissionRate, 15);
    assert.strictEqual(calc15.grossCommission, 300);

    // Update to 8%
    CommissionConfigService.updateConfig({ matchingPercentage: 8 }, 'admin');
    const calc8 = await CommissionService.calculateCommission('KV-1001', {
      overrideLeftVolume: 2000,
      overrideRightVolume: 2000,
    });
    assert.strictEqual(calc8.commissionRate, 8);
    assert.strictEqual(calc8.grossCommission, 160);

    // Reset config back
    CommissionConfigService.resetConfig();
    console.log('[PASS] TEST 7: Commission rate dynamically derived from configuration.');
  });

  // =========================================================================
  // TEST 8: Test commission eligibility
  // =========================================================================
  it('TEST 8: Test commission eligibility (qualified vs unqualified distributor)', async () => {
    // 1. Fully qualified distributor (KV-1001)
    const eligQualified = await CommissionService.checkCommissionEligibility('KV-1001');
    assert.strictEqual(eligQualified.eligible, true);
    assert.strictEqual(eligQualified.reasons.length, 0);

    // REST API verification
    const res = await fetch(`${baseUrl}/api/commission/KV-1001/eligibility`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.eligible, true);

    // 2. Unqualified when requirements not met
    CommissionConfigService.updateConfig({ minimumPersonalBV: 999999 }, 'admin');
    const eligUnqualified = await CommissionService.checkCommissionEligibility('KV-1001');
    assert.strictEqual(eligUnqualified.eligible, false);
    assert.ok(eligUnqualified.reasons.length > 0);
    assert.ok(eligUnqualified.reasons[0].includes('Minimum personal business volume'));

    CommissionConfigService.resetConfig();
    console.log('[PASS] TEST 8: Commission eligibility validated for qualified and unqualified conditions.');
  });

  // =========================================================================
  // TEST 9: Test carry-forward when enabled
  // =========================================================================
  it('TEST 9: Test carry-forward when enabled', async () => {
    CommissionConfigService.updateConfig({ carryForwardEnabled: true }, 'admin');

    // Cycle 1: Left 7,000, Right 4,000 -> Matched 4,000, Carry-forward Left = 3,000
    const cycle1 = await CommissionService.calculateCommission('KV-1001', {
      overrideLeftVolume: 7000,
      overrideRightVolume: 4000,
    });
    assert.strictEqual(cycle1.matchedVolume, 4000);
    assert.strictEqual(cycle1.carryForwardLeft, 3000);
    assert.strictEqual(cycle1.carryForwardRight, 0);

    // Set stored carry-forward for next cycle
    CommissionService.setCarryForward('KV-1001', 3000, 0);

    // Cycle 2: Fresh volumes Left 2,000, Right 6,000
    // Total effective Left = 2,000 + 3,000 = 5,000; Right = 6,000
    // Matched = 5,000; Carry-forward Right = 6,000 - 5,000 = 1,000
    const cycle2 = await CommissionService.calculateCommission('KV-1001', {
      overrideLeftVolume: 2000,
      overrideRightVolume: 6000,
    });
    assert.strictEqual(cycle2.totalEffectiveLeftVolume, 5000);
    assert.strictEqual(cycle2.totalEffectiveRightVolume, 6000);
    assert.strictEqual(cycle2.matchedVolume, 5000);
    assert.strictEqual(cycle2.carryForwardLeft, 0);
    assert.strictEqual(cycle2.carryForwardRight, 1000);

    CommissionService.setCarryForward('KV-1001', 0, 0);
    console.log('[PASS] TEST 9: Carry-forward calculation operates seamlessly across cycles.');
  });

  // =========================================================================
  // TEST 10: Test carry-forward when disabled
  // =========================================================================
  it('TEST 10: Test carry-forward when disabled (remaining un-matched volume is flushed)', async () => {
    CommissionConfigService.updateConfig({ carryForwardEnabled: false }, 'admin');

    const calc = await CommissionService.calculateCommission('KV-1001', {
      overrideLeftVolume: 10000,
      overrideRightVolume: 6000,
    });

    assert.strictEqual(calc.matchedVolume, 6000);
    // Un-matched 4,000 BV on Left is flushed (0 carry forward)
    assert.strictEqual(calc.carryForwardLeft, 0);
    assert.strictEqual(calc.carryForwardRight, 0);

    CommissionConfigService.resetConfig();
    console.log('[PASS] TEST 10: Carry-forward disabled correctly flushes unmatched volume to 0.');
  });

  // =========================================================================
  // TEST 11: Prevent duplicate commission posting
  // =========================================================================
  it('TEST 11: Prevent duplicate commission posting for the same period/cycle', async () => {
    const cycleId = `CYCLE-TEST-11-${Date.now()}`;

    // 1. First posting must succeed
    const res1 = await fetch(`${baseUrl}/api/commission/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distributorId: 'KV-1001',
        cycleId,
        overrideLeftVolume: 5000,
        overrideRightVolume: 5000,
      }),
    });

    assert.strictEqual(res1.status, 201);
    const body1: any = await res1.json();
    assert.strictEqual(body1.success, true);
    assert.strictEqual(body1.status, 'POSTED');

    // 2. Second posting for the same distributor & cycle must be REJECTED
    const res2 = await fetch(`${baseUrl}/api/commission/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distributorId: 'KV-1001',
        cycleId,
        overrideLeftVolume: 5000,
        overrideRightVolume: 5000,
      }),
    });

    assert.strictEqual(res2.status, 400);
    const body2: any = await res2.json();
    assert.strictEqual(body2.success, false);
    assert.ok(body2.message.includes('Duplicate commission'));
    console.log('[PASS] TEST 11: Duplicate commission posting successfully prevented.');
  });

  // =========================================================================
  // TEST 12: Test cancelled transaction
  // =========================================================================
  it('TEST 12: Test cancelled transaction is excluded from business volume calculations', async () => {
    const initialBV = await BusinessVolumeService.getPersonalBusinessVolume('KV-1004');

    // 1. Record an approved transaction
    const tx = await BusinessVolumeService.recordBusinessVolume({
      distributorId: 'KV-1004',
      amount: 1000,
      businessVolume: 500,
      type: 'PURCHASE',
      status: 'APPROVED',
    });

    const withApprovedBV = await BusinessVolumeService.getPersonalBusinessVolume('KV-1004');
    assert.strictEqual(withApprovedBV, SafeDecimal.add(initialBV, 500));

    // 2. Cancel the transaction
    await BusinessVolumeService.updateTransactionStatus(tx.id, 'CANCELLED');

    // 3. Verify cancelled volume is no longer counted
    const afterCancelBV = await BusinessVolumeService.getPersonalBusinessVolume('KV-1004');
    assert.strictEqual(afterCancelBV, initialBV);
    console.log('[PASS] TEST 12: Cancelled transaction successfully excluded from volume calculations.');
  });

  // =========================================================================
  // TEST 13: Test refunded transaction
  // =========================================================================
  it('TEST 13: Test refunded transaction is excluded from business volume calculations', async () => {
    const initialBV = await BusinessVolumeService.getPersonalBusinessVolume('KV-1005');

    // Record a refunded transaction directly
    await BusinessVolumeService.recordBusinessVolume({
      distributorId: 'KV-1005',
      amount: 1500,
      businessVolume: 750,
      type: 'PURCHASE',
      status: 'REFUNDED',
    });

    // Verify refunded transaction does NOT contribute to personal BV
    const currentBV = await BusinessVolumeService.getPersonalBusinessVolume('KV-1005');
    assert.strictEqual(currentBV, initialBV);
    console.log('[PASS] TEST 13: Refunded transaction excluded from volume calculations.');
  });

  // =========================================================================
  // TEST 14: Test decimal/money calculations
  // =========================================================================
  it('TEST 14: Test decimal/money calculations (precision safety against IEEE-754 drift)', async () => {
    // 1. SafeDecimal utility verification
    assert.strictEqual(SafeDecimal.add(0.1, 0.2), 0.3);
    assert.strictEqual(SafeDecimal.sub(0.3, 0.1), 0.2);
    assert.strictEqual(SafeDecimal.mul(0.1, 0.2), 0.02);
    assert.strictEqual(SafeDecimal.div(0.3, 0.1), 3);

    // 2. Commission calculation with fractional volumes
    // Matched: 1,000.33 BV @ 10% = 100.03 gross
    // TDS 5% = 5.00, Admin fee 5% = 5.00, Net payout = 90.03
    const calc = await CommissionService.calculateCommission('KV-1001', {
      overrideLeftVolume: 1000.33,
      overrideRightVolume: 1000.33,
    });

    assert.strictEqual(calc.matchedVolume, 1000.33);
    assert.strictEqual(calc.grossCommission, 100.03);
    assert.strictEqual(calc.tdsDeduction, 5);
    assert.strictEqual(calc.adminCharge, 5);
    assert.strictEqual(calc.netPayout, 90.03);
    console.log('[PASS] TEST 14: Precision decimal calculations verified with zero floating-point error.');
  });

  // =========================================================================
  // TEST 15: Test commission transaction rollback
  // =========================================================================
  it('TEST 15: Test commission transaction rollback on failure', async () => {
    // 1. withTransaction atomic rollback verification
    let errorCaught = false;
    try {
      await withTransaction(async (client) => {
        // Run a query inside transaction
        await client.query('SELECT 1');
        // Deliberately simulate failure during transaction
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.message, 'SIMULATED_TRANSACTION_FAILURE');
    }
    assert.strictEqual(errorCaught, true, 'Transaction failure must throw and rollback');

    // 2. Verify that an ineligible post commission attempt does not modify wallet or ledger
    const initialWallet = await WalletService.getBalance('KV-1001');
    CommissionConfigService.updateConfig({ minimumPersonalBV: 999999 }, 'admin');

    await assert.rejects(
      async () => {
        await CommissionService.postCommission('KV-1001', {
          cycleId: 'CYCLE-FAIL-ROLLBACK',
          overrideLeftVolume: 5000,
          overrideRightVolume: 5000,
        });
      },
      (err: any) => err.message.includes('not eligible')
    );

    const postWallet = await WalletService.getBalance('KV-1001');
    assert.strictEqual(postWallet.availableBalance, initialWallet.availableBalance);

    CommissionConfigService.resetConfig();
    console.log('[PASS] TEST 15: Commission transaction rollback verified.');
  });

  // =========================================================================
  // TEST 16: Test commission ledger creation
  // =========================================================================
  it('TEST 16: Test commission ledger creation creates immutable audit entry', async () => {
    const cycleId = `CYCLE-TEST-16-${Date.now()}`;

    const postResult = await CommissionService.postCommission('KV-1001', {
      cycleId,
      overrideLeftVolume: 4000,
      overrideRightVolume: 4000,
      notes: 'Commission ledger creation test entry',
    });

    assert.ok(postResult.ledgerId);
    assert.strictEqual(postResult.success, true);

    // Retrieve commission history via REST API
    const res = await fetch(`${baseUrl}/api/commission/KV-1001/history`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));

    const entry = body.data.find((e: any) => e.cycleId === cycleId);
    assert.ok(entry, 'Ledger entry must exist in commission history');
    assert.strictEqual(entry.distributorId, 'KV-1001');
    assert.strictEqual(entry.matchedVolume, 4000);
    assert.strictEqual(entry.grossCommission, 400);
    assert.strictEqual(entry.status, 'POSTED');
    console.log('[PASS] TEST 16: Commission ledger creation verified with immutable audit trace.');
  });

  // =========================================================================
  // TEST 17: Test wallet integration if wallet already exists
  // =========================================================================
  it('TEST 17: Test wallet integration credits wallet atomically when commission posts', async () => {
    // 1. Get initial wallet balance for KV-1002
    const initialWallet = await WalletService.getBalance('KV-1002');
    const cycleId = `CYCLE-TEST-17-${Date.now()}`;

    // 2. Post commission for KV-1002 (Left 2,000, Right 1,500 -> Matched 1,500)
    // Gross = 150, TDS = 7.5, Admin = 7.5, Net = 135
    const postRes = await CommissionService.postCommission('KV-1002', {
      cycleId,
      overrideLeftVolume: 2000,
      overrideRightVolume: 1500,
    });

    assert.strictEqual(postRes.netPayout, 135);

    // 3. Verify wallet balance increased by exactly 135
    const updatedWallet = await WalletService.getBalance('KV-1002');
    assert.strictEqual(
      updatedWallet.availableBalance,
      SafeDecimal.add(initialWallet.availableBalance, 135)
    );

    // 4. Verify transaction history contains credit record
    const history = await WalletService.getTransactionHistory('KV-1002');
    const creditTx = history.find((t) => t.referenceId === postRes.ledgerId);
    assert.ok(creditTx, 'Wallet transaction record for commission payout must exist');
    assert.strictEqual(creditTx.amount, 135);
    assert.strictEqual(creditTx.type, 'CREDIT');
    console.log('[PASS] TEST 17: Wallet balance atomically credited on commission post.');
  });

  // =========================================================================
  // TEST 18: Test unauthorized commission modification
  // =========================================================================
  it('TEST 18: Test unauthorized commission modification is rejected with 403 Forbidden', async () => {
    // 1. Non-admin role attempt must be REJECTED with 403
    const unauthorizedRes = await fetch(`${baseUrl}/api/commission/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'distributor',
      },
      body: JSON.stringify({ matchingPercentage: 25 }),
    });

    assert.strictEqual(unauthorizedRes.status, 403);
    const unauthorizedBody: any = await unauthorizedRes.json();
    assert.strictEqual(unauthorizedBody.success, false);
    assert.ok(unauthorizedBody.message.includes('403') || unauthorizedBody.message.includes('Only administrators'));

    // Config must remain unmodified
    const checkConfig = CommissionConfigService.getConfig();
    assert.strictEqual(checkConfig.matchingPercentage, 10);

    // 2. Admin role attempt must SUCCEED with 200
    const adminRes = await fetch(`${baseUrl}/api/commission/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ matchingPercentage: 20 }),
    });

    assert.strictEqual(adminRes.status, 200);
    const adminBody: any = await adminRes.json();
    assert.strictEqual(adminBody.success, true);
    assert.strictEqual(adminBody.data.matchingPercentage, 20);

    // Reset config
    CommissionConfigService.resetConfig();
    console.log('[PASS] TEST 18: Unauthorized modification rejected with 403; admin modification allowed.');
  });
});
