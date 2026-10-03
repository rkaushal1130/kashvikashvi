import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const FIVE_MLM_LEVELS = [
  {
    name: 'Silver',
    code: 'SILVER',
    order: 1,
    requiredBB: new Prisma.Decimal('250.00'),
    requiredMatching: new Prisma.Decimal('2000.00'),
  },
  {
    name: 'Gold',
    code: 'GOLD',
    order: 2,
    requiredBB: new Prisma.Decimal('250.00'),
    requiredMatching: new Prisma.Decimal('5000.00'),
  },
  {
    name: 'Platinum',
    code: 'PLATINUM',
    order: 3,
    requiredBB: new Prisma.Decimal('500.00'),
    requiredMatching: new Prisma.Decimal('50000.00'),
  },
  {
    name: 'Diamond',
    code: 'DIAMOND',
    order: 4,
    requiredBB: new Prisma.Decimal('1000.00'),
    requiredMatching: new Prisma.Decimal('60000.00'),
  },
  {
    name: 'Ruby',
    code: 'RUBY',
    order: 5,
    requiredBB: new Prisma.Decimal('1000.00'),
    requiredMatching: new Prisma.Decimal('100000.00'),
  },
];

export async function seedLevels(dbClient?: PrismaClient) {
  const db = dbClient || prisma;
  console.log('🌟 Seeding 5 Configurable MLM Levels into Database (Silver, Gold, Platinum, Diamond, Ruby)...');

  const seeded = [];
  for (const lvl of FIVE_MLM_LEVELS) {
    const levelRecord = await db.level.upsert({
      where: { code: lvl.code },
      update: {
        name: lvl.name,
        order: lvl.order,
        requiredBB: lvl.requiredBB,
        requiredMatching: lvl.requiredMatching,
        isActive: true,
      },
      create: {
        name: lvl.name,
        code: lvl.code,
        order: lvl.order,
        requiredBB: lvl.requiredBB,
        requiredMatching: lvl.requiredMatching,
        isActive: true,
      },
    });

    console.log(
      `   ✅ [Level ${levelRecord.order}] ${levelRecord.name} (${levelRecord.code}) | Required BB: ${levelRecord.requiredBB} | Required Matching: ${levelRecord.requiredMatching}`
    );
    seeded.push(levelRecord);
  }

  return seeded;
}

if (process.argv[1]?.includes('seedLevels.ts')) {
  seedLevels()
    .then(() => {
      console.log('🎉 MLM Levels seeded successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error seeding MLM Levels:', err);
      process.exit(1);
    });
}
