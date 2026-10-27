import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adminCommissionDistributionApi } from '../api/adminCommissionDistributionApi.js';

describe('COMMISSION DISTRIBUTION & PNB BANKING INTEGRATION TESTS', () => {
  test('TEST 1: adminCommissionDistributionApi exposes all required endpoints', () => {
    assert.equal(typeof adminCommissionDistributionApi.getSummary, 'function');
    assert.equal(typeof adminCommissionDistributionApi.getPreview, 'function');
    assert.equal(typeof adminCommissionDistributionApi.createBatch, 'function');
    assert.equal(typeof adminCommissionDistributionApi.getBatches, 'function');
    assert.equal(typeof adminCommissionDistributionApi.getBatchDetails, 'function');
    assert.equal(typeof adminCommissionDistributionApi.approveBatch, 'function');
    assert.equal(typeof adminCommissionDistributionApi.rejectBatch, 'function');
    assert.equal(typeof adminCommissionDistributionApi.initiatePayout, 'function');
    assert.equal(typeof adminCommissionDistributionApi.reconcileMis, 'function');
    assert.equal(typeof adminCommissionDistributionApi.getQuarantine, 'function');
    assert.equal(typeof adminCommissionDistributionApi.remediateItem, 'function');
    assert.equal(typeof adminCommissionDistributionApi.getPnbFileDownloadUrl, 'function');
    assert.equal(typeof adminCommissionDistributionApi.getBatchReportDownloadUrl, 'function');
  });

  test('TEST 2: getSummary returns PNB corporate account details & float metrics', async () => {
    const res = await adminCommissionDistributionApi.getSummary();
    assert.equal(res.success, true);
    assert.ok(res.data, 'Must return summary data');

    // Corporate PNB Details
    assert.equal(res.data.corporateAccountNumber, '1923102100000382');
    assert.equal(res.data.corporateIfsc, 'PUNB0192310');
    assert.ok(res.data.corporatePnbBalance > 0, 'Float balance must be positive');
    assert.ok(res.data.eligibleCommissionsTotal >= 0);
    assert.ok(res.data.readyForPnbDisbursalTotal >= 0);
  });

  test('TEST 3: getPreview returns all 5 ranks with exact percentages', async () => {
    const res = await adminCommissionDistributionApi.getPreview('CYCLE-TEST');
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.data.beneficiaries), 'Must return beneficiaries array');

    const ranks = res.data.beneficiaries.map((b) => b.rankCode);
    assert.ok(ranks.includes('RUBY'), 'Must include Ruby rank');
    assert.ok(ranks.includes('DIAMOND'), 'Must include Diamond rank');
    assert.ok(ranks.includes('PLATINUM'), 'Must include Platinum rank');
    assert.ok(ranks.includes('GOLD'), 'Must include Gold rank');
    assert.ok(ranks.includes('SILVER'), 'Must include Silver rank');

    // Check rate schedule
    const ruby = res.data.beneficiaries.find((b) => b.rankCode === 'RUBY');
    assert.equal(ruby.rankPercentage, 54);

    const diamond = res.data.beneficiaries.find((b) => b.rankCode === 'DIAMOND');
    assert.equal(diamond.rankPercentage, 50);

    const platinum = res.data.beneficiaries.find((b) => b.rankCode === 'PLATINUM');
    assert.equal(platinum.rankPercentage, 45);

    const gold = res.data.beneficiaries.find((b) => b.rankCode === 'GOLD');
    assert.equal(gold.rankPercentage, 32);

    const silver = res.data.beneficiaries.find((b) => b.rankCode === 'SILVER');
    assert.equal(silver.rankPercentage, 24);
  });

  test('TEST 4: Beneficiary bank accounts are strictly masked in client responses', async () => {
    const res = await adminCommissionDistributionApi.getPreview('CYCLE-TEST');
    for (const b of res.data.beneficiaries) {
      assert.ok(b.bankAccount.maskedAccountNumber.startsWith('XXXXXX'), 'Account must be masked');
      assert.ok(!b.bankAccount.accountNumber, 'Unmasked account number must not be exposed');
      assert.equal(b.bankAccount.password, undefined);
      assert.equal(b.bankAccount.pin, undefined);
    }
  });

  test('TEST 5: getBatches returns batch history with Maker-Checker tracking', async () => {
    const res = await adminCommissionDistributionApi.getBatches();
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.data.batches));
    assert.ok(res.data.batches.length > 0);

    const first = res.data.batches[0];
    assert.ok(first.batchNumber.startsWith('PB-'), 'Batch number format PB-...');
    assert.ok(first.initiatedByAdminId, 'Must record maker ID');
    assert.ok(first.approvedByAdminId, 'Must record checker ID');
    assert.ok(first.payoutMode === 'PNB_BANK_TRANSFER' || first.payoutMode === 'WALLET_CREDIT');
  });

  test('TEST 6: Download URL generators produce valid endpoints', () => {
    const pnbUrl = adminCommissionDistributionApi.getPnbFileDownloadUrl('batch-123');
    assert.equal(pnbUrl, '/api/v1/admin/commission-distribution/batches/batch-123/export-pnb');

    const csvUrl = adminCommissionDistributionApi.getBatchReportDownloadUrl('batch-123');
    assert.equal(csvUrl, '/api/v1/admin/commission-distribution/batches/batch-123/export');
  });
});
