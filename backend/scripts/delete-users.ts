import { prisma } from '../src/config/database';

async function main() {
  console.log('Counting users before deletion...');
  const userCountBefore = await prisma.user.count();
  console.log('Current user count:', userCountBefore);

  console.log('Truncating users table with CASCADE...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE;');

  const userCountAfter = await prisma.user.count();
  console.log('User count after deletion:', userCountAfter);

  const roles = await prisma.role.findMany({ select: { id: true, name: true, description: true } });
  console.log('Roles remaining in table:', roles);
}

main()
  .catch((err) => {
    console.error('Error during deletion:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
