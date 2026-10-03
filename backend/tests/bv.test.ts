import {
  bvSourceTypeEnum,
  creditBVSchema,
  debitBVSchema,
  reverseBVTransactionSchema,
  bvLedgerQuerySchema,
} from '../src/validators/bv.validators';
import { BVService } from '../src/services/bv.service';
import { BVController } from '../src/controllers/bv.controller';

export async function runBVLedgerTests() {
  console.log('\n=== RUNNING IMMUTABLE BV LEDGER TEST SUITE ===\n');

  // Test 8.1: BVSourceType Enum Validation
  console.log('1. Testing BVSourceType Enum Values:');
  const validSourceTypes = ['ORDER', 'ORDER_REFUND', 'ADJUSTMENT', 'BONUS', 'REVERSAL'];
  for (const st of validSourceTypes) {
    const res = bvSourceTypeEnum.safeParse(st);
    if (!res.success) {
      throw new Error(`BVSourceType '${st}' failed validation`);
    }
  }
  const invalidType = bvSourceTypeEnum.safeParse('INVALID_TYPE');
  if (invalidType.success) {
    throw new Error('BVSourceType accepted an invalid enum value');
  }
  console.log('   - Valid source types (ORDER, ORDER_REFUND, ADJUSTMENT, BONUS, REVERSAL): [PASS]');
  console.log('   - Rejection of invalid source types: [PASS]\n');

  // Test 8.2: Mandatory Reference (sourceId) Requirement
  console.log('2. Testing Mandatory Reference (sourceId) Requirement:');
  const validCredit = creditBVSchema.safeParse({
    distributorId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    sourceType: 'ORDER',
    sourceId: 'ORD-2026-9999', // Valid reference
    bv: 100,
    position: 'LEFT',
  });
  if (!validCredit.success) {
    throw new Error('Valid credit failed validation: ' + JSON.stringify(validCredit.error));
  }
  console.log('   - Valid BV credit with reference (sourceId): [PASS]');

  const creditMissingRef = creditBVSchema.safeParse({
    distributorId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    sourceType: 'ORDER',
    sourceId: '', // Blank reference
    bv: 100,
  });
  if (creditMissingRef.success) {
    throw new Error('creditBVSchema accepted an empty reference (sourceId)');
  }
  console.log('   - Empty reference (sourceId) in creditBVSchema properly rejected: [PASS]');

  const debitMissingRef = debitBVSchema.safeParse({
    distributorId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    sourceType: 'ADJUSTMENT',
    sourceId: '   ', // Whitespace reference
    bv: 50,
  });
  if (debitMissingRef.success) {
    throw new Error('debitBVSchema accepted whitespace reference');
  }
  console.log('   - Empty reference (sourceId) in debitBVSchema properly rejected: [PASS]\n');

  // Test 8.3: Amount Validation (Positive BV only)
  console.log('3. Testing BV Amount Numerical Constraints:');
  const creditNegative = creditBVSchema.safeParse({
    distributorId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    sourceId: 'REF-001',
    bv: -25,
  });
  if (creditNegative.success) {
    throw new Error('creditBVSchema accepted negative BV');
  }

  const creditZero = creditBVSchema.safeParse({
    distributorId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    sourceId: 'REF-001',
    bv: 0,
  });
  if (creditZero.success) {
    throw new Error('creditBVSchema accepted 0 BV');
  }
  console.log('   - Negative and zero BV credit properly rejected: [PASS]');

  const debitZero = debitBVSchema.safeParse({
    distributorId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    sourceId: 'REF-002',
    bv: 0,
  });
  if (debitZero.success) {
    throw new Error('debitBVSchema accepted 0 BV');
  }
  console.log('   - Zero BV debit properly rejected: [PASS]\n');

  // Test 8.4: Reversal Schema Validation
  console.log('4. Testing Reversal Schema Validation:');
  const validReversal = reverseBVTransactionSchema.safeParse({
    originalTransactionId: '11111111-2222-3333-4444-555555555555',
    reason: 'Customer cancelled order before shipping',
    referenceId: 'CAN-ORD-90210',
  });
  if (!validReversal.success) {
    throw new Error('Valid reversal failed validation: ' + JSON.stringify(validReversal.error));
  }
  console.log('   - Valid reversal schema: [PASS]');

  const reversalMissingReason = reverseBVTransactionSchema.safeParse({
    originalTransactionId: '11111111-2222-3333-4444-555555555555',
    reason: '  ',
    referenceId: 'CAN-ORD-90210',
  });
  if (reversalMissingReason.success) {
    throw new Error('reverseBVTransactionSchema accepted blank reason');
  }
  console.log('   - Reversal schema requires non-empty reason: [PASS]\n');

  // Test 8.5: Immutability Verification (No Update/Delete Methods Allowed)
  console.log('5. Testing Immutability Guarantees:');
  const forbiddenMethods = ['updateBV', 'deleteBV', 'editBV', 'removeBV', 'modifyBV'];
  for (const fm of forbiddenMethods) {
    if ((BVService as any)[fm] !== undefined) {
      throw new Error(`CRITICAL IMMUTABILITY VIOLATION: BVService.${fm} must NOT exist!`);
    }
    if ((BVController as any)[fm] !== undefined) {
      throw new Error(`CRITICAL IMMUTABILITY VIOLATION: BVController.${fm} must NOT exist!`);
    }
  }
  console.log('   - Verified that no update, delete, or silent edit methods exist on BVService: [PASS]');
  console.log('   - Verified that no update or delete handlers exist on BVController: [PASS]\n');

  // Test 8.6: Required Methods on BVService
  console.log('6. Verifying Required BVService Methods:');
  const requiredMethods = [
    'creditBV',
    'debitBV',
    'getBalance',
    'getPeriodBV',
    'getLeftBV',
    'getRightBV',
    'reverseTransaction',
    'getLedger',
    'formatBVEntry',
  ];
  for (const rm of requiredMethods) {
    if (typeof (BVService as any)[rm] !== 'function') {
      throw new Error(`Required method BVService.${rm} is missing or not a function`);
    }
    console.log(`   - BVService.${rm}(): IMPLEMENTED & VERIFIED`);
  }

  // Test 8.7: Formatting and Numeric Precision Test
  console.log('\n7. Testing Immutable BVLedger Format & Balance Logic:');
  const mockEntry = {
    id: 'bve-001',
    distributorId: 'dist-123',
    businessCenterId: 'bc-456',
    sourceType: 'ORDER',
    sourceId: 'ORD-789',
    bv: 125.5,
    balanceAfter: 250.75,
    position: 'LEFT',
    sourceDistributorId: 'dist-source',
    commissionPeriodId: 'PER-2026-W38',
    orderId: 'ORD-789',
    type: 'ORDER_ACCRUAL',
    description: 'Order BV accrual',
    createdAt: new Date('2026-09-22T10:00:00Z'),
  };

  const formatted = BVService.formatBVEntry(mockEntry);
  if (formatted.bv !== 125.5 || formatted.balanceAfter !== 250.75) {
    throw new Error('formatBVEntry numerical conversion mismatch');
  }
  if (formatted.sourceType !== 'ORDER' || formatted.sourceId !== 'ORD-789') {
    throw new Error('formatBVEntry metadata mapping failed');
  }
  console.log('   - Numeric conversion and field mapping: [PASS]');
  console.log('   - balanceAfter correctly represented as number: [PASS]');

  console.log('\n========================================================');
  console.log('>>> IMMUTABLE BV LEDGER SUITE: ALL TESTS PASSED! <<<');
  console.log('========================================================\n');
}

describe('IMMUTABLE BV LEDGER SUITE', () => {
  it('should pass all immutable BV ledger checks', async () => {
    await runBVLedgerTests();
  });
});

