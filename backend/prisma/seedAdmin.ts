import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://7f447c959c4cc00708c79bfd4c4caf3352cda71fce39743e70f01b4a6b67656e:sk_mX2p6GjVs-_JOXcnZqKA0@db.prisma.io:5432/postgres?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

export const ARGON2_CONFIG: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_CONFIG);
}

export interface SeedAdminOptions {
  email?: string;
  password?: string;
  databaseUrl?: string;
}

export async function seedSuperAdmin(options: SeedAdminOptions = {}): Promise<void> {
  console.log(`\n==================================================`);
  console.log(`🔌 Connecting to Database:`);
  console.log(`   ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`==================================================\n`);

  // 1. Ensure ADMIN role exists with full super-admin root permissions
  console.log('1️⃣ Ensuring canonical ADMIN role exists...');
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
  console.log(`   ✅ ADMIN role verified (${adminRole.id})`);

  // 2. Primary Super Admin (admin@kashvimlm.com)
  const primaryEmail = options.email || process.env.ADMIN_EMAIL || 'admin@kashvimlm.com';
  const primaryPassword = options.password || process.env.ADMIN_PASSWORD || 'Admin@Kashvimlm#1001';
  const primaryHash = await hashPassword(primaryPassword);

  console.log(`\n2️⃣ Upserting Primary Super Admin (${primaryEmail})...`);
  const adminUser = await prisma.user.upsert({
    where: { email: primaryEmail },
    update: {
      fullName: 'Admin',
      phone: '9876543210',
      referralCode: 'KV-1001',
      passwordHash: primaryHash,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
    create: {
      fullName: 'Admin',
      email: primaryEmail,
      phone: '9876543210',
      referralCode: 'KV-1001',
      passwordHash: primaryHash,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      securityProfile: {
        create: {
          twoFactorEnabled: false,
        },
      },
    },
  });

  // Ensure security profile reset if existing
  await prisma.securityProfile.upsert({
    where: { userId: adminUser.id },
    update: {
      failedLoginAttempts: 0,
      lockoutUntil: null,
    },
    create: {
      userId: adminUser.id,
      failedLoginAttempts: 0,
      twoFactorEnabled: false,
    },
  });

  // Ensure primary distributor profile (KV-1001)
  const adminProfile = await prisma.distributorProfile.upsert({
    where: { userId: adminUser.id },
    update: {
      distributorId: 'KV-1001',
      distributorCode: 'KV-1001',
      firstName: 'Admin',
      lastName: '',
      displayName: 'Admin',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    },
    create: {
      userId: adminUser.id,
      distributorId: 'KV-1001',
      distributorCode: 'KV-1001',
      firstName: 'Admin',
      lastName: '',
      displayName: 'Admin',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    },
  });

  // Ensure root business center (KV-1001-BC1)
  const adminBC1 = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-1001-BC1' },
    update: {
      status: 'ACTIVE',
    },
    create: {
      distributorId: adminProfile.id,
      centerNumber: 1,
      centerCode: 'KV-1001-BC1',
      status: 'ACTIVE',
      leftVolume: 0,
      rightVolume: 0,
    },
  });

  // Ensure root MLM Node in Binary Tree
  await prisma.mLMNode.upsert({
    where: { businessCenterId: adminBC1.id },
    update: {},
    create: {
      businessCenterId: adminBC1.id,
      distributorId: adminProfile.id,
      depth: 0,
      binaryPath: 'ROOT',
    },
  });
  console.log(`   ✅ Primary Super Admin verified with password: "${primaryPassword}"`);

  // 3. Demo Admin (admin@example.com) - commonly used in frontend tests & default dev forms
  const exampleEmail = 'admin@example.com';
  const examplePassword = process.env.EXAMPLE_ADMIN_PASSWORD || 'AdminPassword@2026';
  const exampleHash = await hashPassword(examplePassword);

  console.log(`\n3️⃣ Upserting Demo/Dev Admin (${exampleEmail})...`);
  const exampleAdminUser = await prisma.user.upsert({
    where: { email: exampleEmail },
    update: {
      fullName: 'System Administrator',
      phone: '+91 98765 00001',
      referralCode: 'KV-1000',
      passwordHash: exampleHash,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      fullName: 'System Administrator',
      email: exampleEmail,
      phone: '+91 98765 00001',
      referralCode: 'KV-1000',
      passwordHash: exampleHash,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      securityProfile: {
        create: {
          twoFactorEnabled: false,
        },
      },
    },
  });

  await prisma.securityProfile.upsert({
    where: { userId: exampleAdminUser.id },
    update: {
      failedLoginAttempts: 0,
      lockoutUntil: null,
    },
    create: {
      userId: exampleAdminUser.id,
      failedLoginAttempts: 0,
      twoFactorEnabled: false,
    },
  });

  await prisma.distributorProfile.upsert({
    where: { userId: exampleAdminUser.id },
    update: {
      distributorId: 'KV-1000',
      distributorCode: 'KV-1000',
      firstName: 'System',
      lastName: 'Administrator',
      displayName: 'System Administrator',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    },
    create: {
      userId: exampleAdminUser.id,
      distributorId: 'KV-1000',
      distributorCode: 'KV-1000',
      firstName: 'System',
      lastName: 'Administrator',
      displayName: 'System Administrator',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    },
  });
  console.log(`   ✅ Demo Admin (${exampleEmail}) verified with password: "${examplePassword}"`);

  // 4. Secondary Admin (rahulkaushal1109@gmail.com)
  const ownerEmail = 'rahulkaushal1109@gmail.com';
  const ownerPassword = process.env.OWNER_PASSWORD || 'R@hul1130';
  const ownerHash = await hashPassword(ownerPassword);

  console.log(`\n4️⃣ Upserting Secondary Admin (${ownerEmail})...`);
  const ownerUser = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      passwordHash: ownerHash,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: ownerEmail,
      fullName: 'Rahul Kaushal',
      passwordHash: ownerHash,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.securityProfile.upsert({
    where: { userId: ownerUser.id },
    update: {
      failedLoginAttempts: 0,
      lockoutUntil: null,
    },
    create: {
      userId: ownerUser.id,
      failedLoginAttempts: 0,
      twoFactorEnabled: false,
    },
  });
  console.log(`   ✅ Secondary Admin (${ownerEmail}) verified with password: "${ownerPassword}"`);

  // 5. Canonical DISTRIBUTOR Role & Primary Demo Distributor (distributor@example.com / KV-1002)
  console.log(`\n5️⃣ Upserting DISTRIBUTOR role & Demo Distributor (distributor@example.com)...`);
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

  const distEmail = 'distributor@example.com';
  const distPassword = process.env.DISTRIBUTOR_PASSWORD || 'Distributor@123';
  const distHash = await hashPassword(distPassword);

  const distUser = await prisma.user.upsert({
    where: { email: distEmail },
    update: {
      fullName: 'Rahul Example',
      phone: '9876500002',
      referralCode: 'KV-1002',
      passwordHash: distHash,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      fullName: 'Rahul Example',
      email: distEmail,
      phone: '9876500002',
      referralCode: 'KV-1002',
      passwordHash: distHash,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      securityProfile: {
        create: {
          twoFactorEnabled: false,
        },
      },
    },
  });

  await prisma.securityProfile.upsert({
    where: { userId: distUser.id },
    update: {
      failedLoginAttempts: 0,
      lockoutUntil: null,
    },
    create: {
      userId: distUser.id,
      failedLoginAttempts: 0,
      twoFactorEnabled: false,
    },
  });

  const distProfile = await prisma.distributorProfile.upsert({
    where: { userId: distUser.id },
    update: {
      distributorId: 'KV-1002',
      distributorCode: 'KV-1002',
      firstName: 'Rahul',
      lastName: 'Example',
      displayName: 'Rahul Example',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    },
    create: {
      userId: distUser.id,
      distributorId: 'KV-1002',
      distributorCode: 'KV-1002',
      firstName: 'Rahul',
      lastName: 'Example',
      displayName: 'Rahul Example',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    },
  });

  await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-1002-BC1' },
    update: {
      status: 'ACTIVE',
    },
    create: {
      distributorId: distProfile.id,
      centerNumber: 1,
      centerCode: 'KV-1002-BC1',
      status: 'ACTIVE',
      leftVolume: 500,
      rightVolume: 750,
    },
  });

  console.log(`   ✅ Demo Distributor (${distEmail}) verified with password: "${distPassword}"`);

  console.log('\n==================================================');
  console.log('🎉 Super Admin Seed Finished Successfully!');
  console.log('==================================================');
  console.log('You can now log in with ANY of the following credentials:\n');
  console.log(`1. Primary Super Admin:`);
  console.log(`   - Email / Identifier: admin@kashvimlm.com  (or  KV-1001)`);
  console.log(`   - Password:           ${primaryPassword}`);
  console.log(`   - Role:               ADMIN\n`);
  console.log(`2. Demo / Dev Admin:`);
  console.log(`   - Email / Identifier: admin@example.com   (or  KV-1000)`);
  console.log(`   - Password:           ${examplePassword}`);
  console.log(`   - Role:               ADMIN\n`);
  console.log(`3. Secondary Admin:`);
  console.log(`   - Email / Identifier: rahulkaushal1109@gmail.com`);
  console.log(`   - Password:           ${ownerPassword}`);
  console.log(`   - Role:               ADMIN`);
  console.log('==================================================\n');
}

if (require.main === module || process.argv[1]?.includes('seedAdmin.ts')) {
  const args = process.argv.slice(2);
  const email = args[0] || process.env.ADMIN_EMAIL;
  const password = args[1] || process.env.ADMIN_PASSWORD;

  seedSuperAdmin({ email, password })
    .catch((error) => {
      console.error('❌ Error seeding Super Admin password:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
