/**
 * Seeds TEST data for the rank-based commission pool distribution.
 *
 *   npx tsx scripts/test-data/seed-pool-test-data.ts
 *   npx tsx scripts/test-data/cleanup-pool-test-data.ts   (removes it again)
 *
 * Creates (idempotent):
 *   - Missing rank levels GOLD / PLATINUM / DIAMOND / RUBY (real config, NOT removed by cleanup)
 *   - 7 test distributors TEST-POOL-01..07 (emails @example.test): 3 Diamond, 2 Platinum, 2 Silver
 *     all ACTIVE + PAID, each with a bank account (5 VERIFIED, 2 PENDING_VERIFICATION)
 *   - ₹1,000 of APPROVED pool contributions (businessReference TEST_POOL_CONTRIBUTION:*)
 *
 * Expected split of the ₹1,000 pool: Silver 34.28, Platinum 76.28, Diamond 92.94 each;
 * ₹499.94 distributed, ₹500.06 stays in the pool.
 */
import 'dotenv/config';
import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PERIOD = `CYCLE-${new Date().toISOString().slice(0, 10)}`;

const LEVELS = [
  { code: 'GOLD', name: 'Gold', order: 2, bb: 250, match: 5000 },
  { code: 'PLATINUM', name: 'Platinum', order: 3, bb: 500, match: 50000 },
  { code: 'DIAMOND', name: 'Diamond', order: 4, bb: 1000, match: 60000 },
  { code: 'RUBY', name: 'Ruby', order: 5, bb: 1000, match: 100000 },
];

const MEMBERS = [
  { n: 1, first: 'Test Diamond', last: 'One', rank: 'DIAMOND', bv: 1200, match: 65000, bank: 'VERIFIED', contribution: 220 },
  { n: 2, first: 'Test Diamond', last: 'Two', rank: 'DIAMOND', bv: 1100, match: 62000, bank: 'VERIFIED', contribution: 200 },
  { n: 3, first: 'Test Diamond', last: 'Three', rank: 'DIAMOND', bv: 1050, match: 61000, bank: 'VERIFIED', contribution: 180 },
  { n: 4, first: 'Test Platinum', last: 'One', rank: 'PLATINUM', bv: 600, match: 52000, bank: 'VERIFIED', contribution: 150 },
  { n: 5, first: 'Test Platinum', last: 'Two', rank: 'PLATINUM', bv: 550, match: 51000, bank: 'PENDING_VERIFICATION', contribution: 120 },
  { n: 6, first: 'Test Silver', last: 'One', rank: 'SILVER', bv: 300, match: 2500, bank: 'VERIFIED', contribution: 80 },
  { n: 7, first: 'Test Silver', last: 'Two', rank: 'SILVER', bv: 260, match: 2100, bank: 'PENDING_VERIFICATION', contribution: 50 },
]; // contributions total 1000

async function main() {
  // 1. Rank levels (only create the missing ones)
  for (const l of LEVELS) {
    const exists = await prisma.level.findFirst({ where: { OR: [{ code: l.code }, { order: l.order }] } });
    if (!exists) {
      await prisma.level.create({
        data: {
          code: l.code,
          name: l.name,
          order: l.order,
          requiredBB: l.bb,
          requiredMatching: l.match,
          requiredLeftMatching: l.match,
          requiredRightMatching: l.match,
          isActive: true,
        },
      });
      console.log(`+ level ${l.code}`);
    }
  }
  const levels = await prisma.level.findMany({ select: { id: true, code: true } });
  const levelId = (code: string) => {
    const id = levels.find((l) => l.code === code)?.id;
    if (!id) throw new Error(`Level ${code} missing`);
    return id;
  };

  // Match real distributor users' role
  const distributorRole = await prisma.role.findFirst({ where: { name: 'DISTRIBUTOR' } });

  for (const m of MEMBERS) {
    const code = `TEST-POOL-${String(m.n).padStart(2, '0')}`;
    const email = `test.pool.${m.n}@example.test`;
    const fullName = `${m.first} ${m.last}`;

    // 2. User (no usable password: random hash, test data only)
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        userId: code,
        referralCode: code,
        fullName,
        passwordHash: `TEST_DATA_NO_LOGIN_${crypto.randomBytes(16).toString('hex')}`,
        roleName: 'DISTRIBUTOR',
        roleId: distributorRole?.id,
        status: 'ACTIVE',
      },
    });

    // 3. Distributor profile with rank
    const profile = await prisma.distributorProfile.upsert({
      where: { distributorCode: code },
      update: { currentLevelId: levelId(m.rank), status: 'ACTIVE', paymentStatus: 'PAID' },
      create: {
        userId: user.id,
        distributorCode: code,
        distributorId: code,
        firstName: m.first,
        lastName: m.last,
        displayName: fullName,
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        activatedAt: new Date(),
        currentLevelId: levelId(m.rank),
        currentBB: m.bv,
        currentMatching: m.match,
      },
    });

    // 4. Bank account
    const hasBank = await prisma.bankAccount.findFirst({ where: { distributorId: profile.id } });
    if (!hasBank) {
      await prisma.bankAccount.create({
        data: {
          distributorId: profile.id,
          bankName: 'Test Bank',
          accountHolderName: fullName,
          accountNumber: `99990000${String(m.n).padStart(4, '0')}`,
          routingNumber: `TEST000${String(m.n).padStart(4, '0')}`,
          isPrimary: true,
          status: m.bank as any,
        },
      });
    }

    // 5. Approved pool contribution
    const businessReference = `TEST_POOL_CONTRIBUTION:${code}`;
    await prisma.commission.upsert({
      where: { businessReference },
      update: {},
      create: {
        commissionNumber: `TPC-${String(m.n).padStart(2, '0')}-${Date.now().toString().slice(-6)}`,
        businessReference,
        distributorId: profile.id,
        type: 'OTHER',
        status: 'APPROVED',
        amount: new Prisma.Decimal(m.contribution),
        details: { kind: 'POOL_CONTRIBUTION', periodCode: PERIOD, testData: true },
      },
    });

    console.log(`✓ ${code}  ${fullName.padEnd(20)} ${m.rank.padEnd(9)} bank=${m.bank.padEnd(21)} contribution=₹${m.contribution}`);
  }

  const approved = await prisma.commission.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true }, _count: true });
  console.log(`\nApproved commission pool now: ₹${approved._sum.amount} (${approved._count} rows)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
