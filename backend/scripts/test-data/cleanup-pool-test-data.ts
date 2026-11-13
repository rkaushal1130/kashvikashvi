/**
 * Removes the TEST data created by seed-pool-test-data.ts.
 *
 *   npx tsx scripts/test-data/cleanup-pool-test-data.ts
 *
 * Deletes: test.pool.*@example.test distributors (originally TEST-POOL-*) and their users, bank accounts, wallets, wallet
 * transactions, commissions and payout batch items. Rank levels are kept (real config).
 *
 * NOTE: a distribution run leaves an APPROVED "POOL_CARRYOVER" commission on the admin
 * profile. Carry-over rows created from test runs are only removed when passed
 * --include-carryover (they cannot be told apart from real carry-over automatically).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const includeCarryover = process.argv.includes('--include-carryover');

async function main() {
  // Matched by the seed's @example.test emails: distributor codes may since have been
  // renumbered to KK-XXXX by the member-ID repair routine.
  const profiles = await prisma.distributorProfile.findMany({
    where: { user: { email: { startsWith: 'test.pool.', endsWith: '@example.test' } } },
    select: { id: true, userId: true, distributorCode: true },
  });
  const ids = profiles.map((p) => p.id);
  const userIds = profiles.map((p) => p.userId);

  await prisma.$transaction(async (tx) => {
    const wallets = await tx.wallet.findMany({ where: { distributorId: { in: ids } }, select: { id: true } });
    const walletIds = wallets.map((w) => w.id);
    const r = {
      walletTransactions: (await tx.walletTransaction.deleteMany({ where: { walletId: { in: walletIds } } })).count,
      wallets: (await tx.wallet.deleteMany({ where: { id: { in: walletIds } } })).count,
      payoutBatchItems: (await tx.payoutBatchItem.deleteMany({ where: { distributorId: { in: ids } } })).count,
      commissions: (await tx.commission.deleteMany({
        where: { OR: [{ distributorId: { in: ids } }, { businessReference: { startsWith: 'TEST_POOL_CONTRIBUTION:' } }] },
      })).count,
      carryover: includeCarryover
        ? (await tx.commission.deleteMany({ where: { businessReference: { startsWith: 'POOL_CARRYOVER:' } } })).count
        : 0,
      bankAccounts: (await tx.bankAccount.deleteMany({ where: { distributorId: { in: ids } } })).count,
      distributorProfiles: (await tx.distributorProfile.deleteMany({ where: { id: { in: ids } } })).count,
      users: (await tx.user.deleteMany({ where: { id: { in: userIds }, email: { endsWith: '@example.test' } } })).count,
    };
    console.log('Removed:', r);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
