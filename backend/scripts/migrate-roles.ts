import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function migrateRoles(): Promise<void> {
  console.log('🔄 [migrate-roles] Starting 3-role canonical migration...');

  // 1. Ensure the 3 canonical roles exist in the roles table
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {
      description: 'Admin',
      permissions: { all: true, root: true, manage_products: true, manage_users: true },
    },
    create: {
      name: 'ADMIN',
      description: 'Admin',
      permissions: { all: true, root: true, manage_products: true, manage_users: true },
    },
  });

  const distributorRole = await prisma.role.upsert({
    where: { name: 'DISTRIBUTOR' },
    update: {
      description: 'Distributor',
      permissions: { portal: true, businessCenter: true, wallet: true },
    },
    create: {
      name: 'DISTRIBUTOR',
      description: 'Distributor',
      permissions: { portal: true, businessCenter: true, wallet: true },
    },
  });

  const customerCareRole = await prisma.role.upsert({
    where: { name: 'CUSTOMER_CARE' },
    update: {
      description: 'Customer Care',
      permissions: { tickets: true, viewMembers: true, support: true },
    },
    create: {
      name: 'CUSTOMER_CARE',
      description: 'Customer Care',
      permissions: { tickets: true, viewMembers: true, support: true },
    },
  });

  console.log('✅ Canonical roles verified: ADMIN, DISTRIBUTOR, CUSTOMER_CARE');

  // 2. Add CUSTOMER_CARE value to postgres enum if not present
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CUSTOMER_CARE'`);
  } catch (e: any) {
    // Already exists or not supported
  }

  // 3. Migrate users referencing deprecated roles or roleName
  // A. SUPER_ADMIN -> ADMIN
  await prisma.$executeRawUnsafe(`
    UPDATE "users" 
    SET "roleId" = '${adminRole.id}', "roleName" = 'ADMIN' 
    WHERE "roleName"::text = 'SUPER_ADMIN' 
       OR "roleId" IN (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN')
  `);

  // B. SUPPORT -> CUSTOMER_CARE
  await prisma.$executeRawUnsafe(`
    UPDATE "users" 
    SET "roleId" = '${customerCareRole.id}', "roleName" = 'CUSTOMER_CARE' 
    WHERE "roleName"::text = 'SUPPORT' 
       OR "roleId" IN (SELECT "id" FROM "roles" WHERE "name" = 'SUPPORT')
  `);

  // C. CUSTOMER -> DISTRIBUTOR
  await prisma.$executeRawUnsafe(`
    UPDATE "users" 
    SET "roleId" = '${distributorRole.id}', "roleName" = 'DISTRIBUTOR' 
    WHERE "roleName"::text = 'CUSTOMER' 
       OR "roleId" IN (SELECT "id" FROM "roles" WHERE "name" = 'CUSTOMER')
  `);

  // D. Any orphaned user without a valid roleId gets linked to DISTRIBUTOR
  const validRoleIds = [adminRole.id, distributorRole.id, customerCareRole.id];
  await prisma.user.updateMany({
    where: {
      OR: [
        { roleId: null },
        { roleId: { notIn: validRoleIds } },
      ],
    },
    data: {
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
    },
  });

  // 4. Delete all other roles from the roles table
  const deleteResult = await prisma.role.deleteMany({
    where: {
      name: { notIn: ['ADMIN', 'DISTRIBUTOR', 'CUSTOMER_CARE'] },
    },
  });

  console.log(`🗑️ Deleted ${deleteResult.count} deprecated role(s) from the roles table.`);

  const remainingRoles = await prisma.role.findMany({ select: { id: true, name: true, description: true } });
  console.log('✨ [migrate-roles] Exactly 3 roles now in table:');
  console.table(remainingRoles);
}

if (process.argv[1]?.endsWith('migrate-roles.ts') || process.argv[1]?.endsWith('migrate-roles.js')) {
  migrateRoles()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('❌ Failed to migrate roles:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
