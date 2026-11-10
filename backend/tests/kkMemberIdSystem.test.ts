import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemberIdService } from '../src/services/memberId.service';
import { AuthService } from '../src/services/auth.service';

describe('Kashvi MLM – Unique Member ID Generation System (KK-XXXX)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await AuthService.initSeedUsers();
    MemberIdService.resetCounter(1); // Floor: KK-0001 reserved for Super Admin
  });

  it('1. Super Admin ID must be KK-0001 and permanently reserved', () => {
    expect(MemberIdService.SUPER_ADMIN_ID).toBe('KK-0001');
    expect(MemberIdService.FIRST_MEMBER_ID).toBe('KK-0002');
    expect(MemberIdService.isValidMemberId('KK-0001')).toBe(true);
  });

  it('2. First generated member ID must be KK-0002', async () => {
    const firstId = await MemberIdService.generateNextMemberId();
    expect(firstId).toBe('KK-0002');
  });

  it('3. Sequential ID generation: KK-0002, KK-0003, KK-0004, KK-0005, etc.', async () => {
    const id1 = await MemberIdService.generateNextMemberId();
    const id2 = await MemberIdService.generateNextMemberId();
    const id3 = await MemberIdService.generateNextMemberId();
    const id4 = await MemberIdService.generateNextMemberId();

    expect(id1).toBe('KK-0002');
    expect(id2).toBe('KK-0003');
    expect(id3).toBe('KK-0004');
    expect(id4).toBe('KK-0005');
  });

  it('4. Concurrency test: Simultaneous registrations generate strictly unique IDs without duplicates', async () => {
    const count = 50;
    const promises = Array.from({ length: count }, () => MemberIdService.generateNextMemberId());
    const ids = await Promise.all(promises);

    expect(ids).toHaveLength(count);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(count);

    // Ensure all match KK-XXXX format and none match KK-0001
    ids.forEach((id) => {
      expect(id).toMatch(/^KK-\d{4,}$/);
      expect(id).not.toBe('KK-0001');
    });

    // Check strict sequential coverage
    const numbers = ids.map((id) => parseInt(id.replace('KK-', ''), 10)).sort((a, b) => a - b);
    expect(numbers[0]).toBe(2);
    expect(numbers[numbers.length - 1]).toBe(51);
    for (let i = 0; i < numbers.length; i++) {
      expect(numbers[i]).toBe(i + 2);
    }
  });

  it('5. Normalization and validation handles KK-XXXX and case-insensitive formats', () => {
    expect(MemberIdService.isValidMemberId('KK-0001')).toBe(true);
    expect(MemberIdService.isValidMemberId('KK-0002')).toBe(true);
    expect(MemberIdService.isValidMemberId('kk0003')).toBe(true);
    expect(MemberIdService.isValidMemberId('KK-99999')).toBe(true);
    expect(MemberIdService.isValidMemberId('INVALID')).toBe(false);

    expect(MemberIdService.normalizeMemberId('kk0002')).toBe('KK-0002');
    expect(MemberIdService.normalizeMemberId('  kk-0005  ')).toBe('KK-0005');
    expect(MemberIdService.normalizeMemberId('KK0010')).toBe('KK-0010');
  });

  it('6. AuthService registration assigns sequential KK-XXXX IDs to newly registered members', async () => {
    const regResult = await AuthService.register({
      fullName: 'Sunil Kumar',
      email: `sunil.${Date.now()}@example.com`,
      phone: '9876543210',
      password: 'SecurePassword123!',
      sponsorId: 'KK-0001',
    });

    expect(regResult).toBeDefined();
    expect(regResult.user).toBeDefined();
    const assignedId = regResult.user.memberId || regResult.user.distributorCode;
    expect(assignedId).toMatch(/^KK-\d{4,}$/);
    expect(assignedId).not.toBe('KK-0001');
    expect(regResult.user.sponsorId).toBe('KK-0001');
  });
});
