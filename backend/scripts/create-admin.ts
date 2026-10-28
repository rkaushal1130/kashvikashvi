import { prisma } from '../src/config/database';
import { hashPassword, verifyPassword } from '../src/utils/password';

async function main() {
  console.log('Looking up ADMIN role in database...');
  let adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
  });

  if (!adminRole) {
    console.log('Creating ADMIN role...');
    adminRole = await prisma.role.create({
      data: {
        name: 'ADMIN',
        description: 'Admin',
        permissions: { all: true, root: true, manage_products: true, manage_users: true },
      },
    });
  }

  const email = 'admin@kashvimlm.com';
  const plainPassword = 'Admin@Kashvimlm#1001';
  const fullName = 'Admin';
  const phone = '9876543210';
  const referralCode = 'KV-1001';

  console.log('Hashing password with Argon2id...');
  const passwordHash = await hashPassword(plainPassword);

  console.log('Upserting admin user...');
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      phone,
      referralCode,
      passwordHash,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
    create: {
      fullName,
      email,
      phone,
      referralCode,
      passwordHash,
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

  console.log('Upserting admin distributor profile (KV-1001)...');
  const adminProfile = await prisma.distributorProfile.upsert({
    where: { userId: user.id },
    update: {
      distributorId: referralCode,
      distributorCode: referralCode,
      firstName: 'Admin',
      lastName: '',
      displayName: 'Admin',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    },
    create: {
      userId: user.id,
      distributorId: referralCode,
      distributorCode: referralCode,
      firstName: 'Admin',
      lastName: '',
      displayName: 'Admin',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    },
  });

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

  // Root Node in Binary Tree for Admin (KV-1001) BC1
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

  console.log('Admin user setup complete:', {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    referralCode: user.referralCode,
    profileId: adminProfile.id,
    distributorCode: adminProfile.distributorCode,
  });
}

main()
  .catch((err) => {
    console.error('Failed to create/update admin user:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
