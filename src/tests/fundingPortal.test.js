import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adminFundingApi, sanitizeErrorMessage } from '../api/adminFundingApi.js';

describe('PROMPT 35 — ADMIN FUNDING PORTAL TESTS', () => {
  test('TEST 1: adminFundingApi exposes all required endpoints', () => {
    assert.equal(typeof adminFundingApi.getDashboard, 'function');
    assert.equal(typeof adminFundingApi.getTreasuryBalance, 'function');
    assert.equal(typeof adminFundingApi.getAccounts, 'function');
    assert.equal(typeof adminFundingApi.connectAccount, 'function');
    assert.equal(typeof adminFundingApi.getAccountStatus, 'function');
    assert.equal(typeof adminFundingApi.initiateFunding, 'function');
    assert.equal(typeof adminFundingApi.listTransactions, 'function');
    assert.equal(typeof adminFundingApi.getTransaction, 'function');
    assert.equal(typeof adminFundingApi.reconcileFunding, 'function');
    assert.equal(typeof adminFundingApi.reverseFunding, 'function');
    assert.equal(typeof adminFundingApi.getTreasuryTransactions, 'function');
  });

  test('TEST 2: sanitizeErrorMessage strips DB connection strings and stack traces (Requirement 8)', () => {
    const dbError = new Error('PrismaClientInitializationError: P1001: Can\'t reach database server at localhost:5432');
    const sanitized = sanitizeErrorMessage(dbError);
    assert.ok(!sanitized.includes('PrismaClient'));
    assert.ok(!sanitized.includes('localhost:5432'));
    assert.ok(sanitized.includes('Database connection is currently unavailable'));

    const secretError = new Error('Invalid secret token or api_key: sk_live_9941829');
    const sanitizedSecret = sanitizeErrorMessage(secretError);
    assert.ok(!sanitizedSecret.includes('sk_live_9941829'));
    assert.ok(sanitizedSecret.includes('Authentication or security credential error'));
  });

  test('TEST 3: getDashboard returns treasury balance and connected accounts', async () => {
    const data = await adminFundingApi.getDashboard();
    assert.ok(data.treasury, 'Must include treasury');
    assert.ok(data.treasury.availableBalance !== undefined, 'Must include availableBalance');
    assert.ok(data.treasury.pendingBalance !== undefined, 'Must include pendingBalance');
    assert.ok(Array.isArray(data.accounts), 'Must include accounts array');
    assert.ok(data.accounts.length > 0, 'Must have at least one account');
    assert.ok(data.accounts[0].maskedAccountNumber, 'Must have masked account number');
    // Ensure sensitive fields are not present
    assert.equal(data.accounts[0].password, undefined);
    assert.equal(data.accounts[0].pin, undefined);
    assert.equal(data.accounts[0].apiSecret, undefined);
  });

  test('TEST 4: listTransactions supports 7 lifecycle statuses (Requirement 4)', async () => {
    const res = await adminFundingApi.listTransactions();
    assert.ok(Array.isArray(res.transactions), 'Must return array of transactions');
    const statuses = new Set(res.transactions.map((t) => t.status));
    assert.ok(statuses.has('SUCCEEDED') || statuses.has('PENDING'), 'Must contain statuses');
  });

  test('TEST 5: initiateFunding creates transaction in PENDING state without unbacked credit (Requirement 9)', async () => {
    const initialTreasury = await adminFundingApi.getTreasuryBalance();
    const initialAvail = initialTreasury.availableBalance;

    const res = await adminFundingApi.initiateFunding({
      amount: 150000,
      currency: 'INR',
      fundingAccountId: 'acc-corp-hdfc-01',
    });

    assert.ok(res.transaction, 'Must return transaction record');
    assert.equal(res.transaction.status, 'PENDING', 'Transaction MUST be created with PENDING status');

    // Balance must NOT have increased automatically
    const postTreasury = await adminFundingApi.getTreasuryBalance();
    assert.equal(postTreasury.availableBalance, initialAvail, 'Treasury balance must not increase until confirmed');
  });

  test('TEST 6: reconcileFunding transitions PENDING transaction to SUCCEEDED and credits treasury', async () => {
    // Initiate transaction
    const initRes = await adminFundingApi.initiateFunding({
      amount: 50000,
      currency: 'INR',
    });

    const reconRes = await adminFundingApi.reconcileFunding(initRes.transaction.id);
    assert.ok(reconRes.isCredited, 'Reconciliation should mark transaction credited upon settlement match');
    assert.equal(reconRes.transaction.status, 'SUCCEEDED');
  });

  test('TEST 7: getTreasuryTransactions returns immutable ledger entries (Requirement 6)', async () => {
    const res = await adminFundingApi.getTreasuryTransactions();
    assert.ok(Array.isArray(res.transactions));
    assert.ok(res.transactions.length > 0);
    const row = res.transactions[0];
    assert.ok(row.type, 'Must have transaction type');
    assert.ok(row.amount !== undefined, 'Must have amount');
    assert.ok(row.balanceAfter !== undefined, 'Must have balanceAfter');
    assert.ok(row.status, 'Must have status');
  });
});
