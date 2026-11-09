import { prisma } from '../config/database';
import { hashPassword, validatePasswordStrength } from '../utils/password';

/**
 * ============================================================================
 * SAFE KASHVI MLM DATABASE RESET & FRESH PRODUCTION INITIALIZATION SERVICE
 * ============================================================================
 * Removes all transactional, genealogy, order, commission, and member data.
 * Seeds exactly ONE canonical Super Admin with zero volume, zero commissions.
 */

// List of all 53 transactional and member data tables to be completely cleared
export const APPLICATION_DATA_TABLES = [
  'wallet_transactions',
  'commission_transactions',
  'commission_reversals',
  'level_commissions',
  'commissions',
  'bonuses',
  'wallets',
  'withdrawal_requests',
  'payout_requests',
  'payout_batch_items',
  'payout_batches',
  'bank_batch_files',
  'platform_wallet_transactions',
  'platform_wallets',
  'funding_transactions',
  'funding_accounts',
  'client_funding_orders',
  'bb_transactions',
  'matching_transactions',
  'reconciliation_audits',
  'bv_ledgers',
  'order_items',
  'payments',
  'orders',
  'cart_items',
  'carts',
  'inventory_transactions',
  'mlm_nodes',
  'business_centers',
  'sponsor_relationships',
  'distributor_status_history',
  'distributor_rank_history',
  'distributor_badges',
  'distributor_websites',
  'website_links',
  'training_progress',
  'member_level_histories',
  'customers',
  'distributor_profiles',
  'addresses',
  'kyc_profiles',
  'bank_accounts',
  'security_profiles',
  'sessions',
  'password_reset_tokens',
  'support_messages',
  'support_tickets',
  'notifications',
  'enrollment_steps',
  'enrollments',
  'audit_logs',
  'webhook_events',
  'users',
];

export interface ResetOptions {
  confirmProductionReset?: boolean;
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  adminPhone?: string;
  adminReferralCode?: string;
}

export class DatabaseMaintenanceService {
  public static async resetDatabase(options: ResetOptions = {}) {
    const isProd = process.env.NODE_ENV === 'production';
    const hasCliConfirm = process.argv.includes('--confirm-production-reset') || options.confirmProductionReset;
    const hasEnvConfirm = process.env.CONFIRM_PRODUCTION_RESET === 'true';

    console.log('\n===============================================================');
    console.log('⚡ KASHVI MLM FRESH PRODUCTION INITIALIZATION & DATABASE RESET');
    console.log('===============================================================');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database Target: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || 'Unspecified'}`);

    // Safeguard: Refuse production reset unless explicitly confirmed
    if (isProd && !hasCliConfirm && !hasEnvConfirm) {
      throw new Error(
        'CRITICAL SAFEGUARD: Running in production requires explicit confirmation!\n' +
        'Pass --confirm-production-reset flag or set CONFIRM_PRODUCTION_RESET=true in environment.'
      );
    }

    // 1. Resolve Admin Credentials from Environment
    const adminEmail = (
      options.adminEmail ||
      process.env.INITIAL_ADMIN_EMAIL ||
      process.env.ADMIN_EMAIL ||
      (isProd ? '' : 'admin@kashvimlm.com')
    ).trim();

    const adminPassword = (
      options.adminPassword ||
      process.env.INITIAL_ADMIN_PASSWORD ||
      process.env.ADMIN_PASSWORD ||
      (isProd ? '' : 'Admin@Kashvimlm#1001')
    ).trim();

    const adminName = (
      options.adminName ||
      process.env.INITIAL_ADMIN_NAME ||
      process.env.ADMIN_NAME ||
      'System Administrator'
    ).trim();

    const adminPhone = (
      options.adminPhone ||
      process.env.INITIAL_ADMIN_PHONE ||
      process.env.ADMIN_PHONE ||
      '9876543210'
    ).trim();

    const referralCode = (
      options.adminReferralCode ||
      process.env.INITIAL_ADMIN_REFERRAL_CODE ||
      process.env.ADMIN_REFERRAL_CODE ||
      'KV-1001'
    ).trim();

    if (!adminEmail) {
      throw new Error('INITIAL_ADMIN_EMAIL must be provided in environment variables.');
    }

    if (!adminPassword) {
      throw new Error('INITIAL_ADMIN_PASSWORD must be provided in environment variables.');
    }

    const strength = validatePasswordStrength(adminPassword);
    if (!strength.isValid) {
      throw new Error(`Admin password does not meet security requirements: ${strength.message}`);
    }

    if (isProd && adminPassword === 'Admin@Kashvimlm#1001') {
      throw new Error('Production reset rejected: Insecure default password cannot be used in production.');
    }

    console.log('\n1️⃣ Clearing application transactional and member data...');
    console.log(`   Total tables to truncate: ${APPLICATION_DATA_TABLES.length}`);

    // Build unified atomic TRUNCATE statement
    const tableListSql = APPLICATION_DATA_TABLES.map((t) => `"${t}"`).join(', ');
    const truncateSql = `TRUNCATE TABLE ${tableListSql} RESTART IDENTITY CASCADE;`;

    await prisma.$executeRawUnsafe(truncateSql);
    console.log('   ✅ All 53 application and genealogy tables truncated successfully.');

    // 2. Reset Member ID Counter
    console.log('\n2️⃣ Resetting sequence counters...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "member_id_counters" ("id", "currentValue", "updatedAt")
      VALUES ('KV_MEMBER_ID', 0, NOW())
      ON CONFLICT ("id") DO UPDATE SET "currentValue" = 0, "updatedAt" = NOW();
    `);
    console.log('   ✅ MemberIdCounter reset to 0.');

    // 3. Ensure Canonical ADMIN Role
    console.log('\n3️⃣ Verifying canonical ADMIN role...');
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {
        description: 'System Super Administrator',
        permissions: { all: true, root: true, manage_products: true, manage_users: true, manage_commissions: true },
      },
      create: {
        name: 'ADMIN',
        description: 'System Super Administrator',
        permissions: { all: true, root: true, manage_products: true, manage_users: true, manage_commissions: true },
      },
    });
    console.log(`   ✅ ADMIN role confirmed (ID: ${adminRole.id})`);

    // 4. Create Single Super Admin Account
    console.log(`\n4️⃣ Creating solitary Super Admin (${adminEmail})...`);
    const passwordHash = await hashPassword(adminPassword);

    const adminUser = await prisma.user.create({
      data: {
        fullName: adminName,
        email: adminEmail,
        phone: adminPhone,
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
            failedLoginAttempts: 0,
          },
        },
      },
    });

    // 5. Create Root Distributor Profile for Admin (Required for Binary Tree Root)
    console.log(`\n5️⃣ Creating root distributor profile (${referralCode})...`);
    const adminProfile = await prisma.distributorProfile.create({
      data: {
        userId: adminUser.id,
        distributorId: referralCode,
        distributorCode: referralCode,
        firstName: adminName.split(' ')[0] || 'System',
        lastName: adminName.split(' ').slice(1).join(' ') || 'Admin',
        displayName: adminName,
        status: 'ACTIVE',
        paymentStatus: 'PAID',
      },
    });

    // 6. Create Admin Root Business Center (Zero Volumes)
    console.log(`\n6️⃣ Creating root business center with 0 volume...`);
    const adminBC1 = await prisma.businessCenter.create({
      data: {
        distributorId: adminProfile.id,
        centerNumber: 1,
        centerCode: `${referralCode}-BC1`,
        status: 'ACTIVE',
        leftVolume: 0,
        rightVolume: 0,
      },
    });

    // 7. Create Root Node in Binary MLM Genealogy Tree
    console.log('\n7️⃣ Initializing root binary genealogy node...');
    await prisma.mLMNode.create({
      data: {
        businessCenterId: adminBC1.id,
        distributorId: adminProfile.id,
        depth: 0,
        binaryPath: 'ROOT',
      },
    });

    // 8. Create Clean Admin Wallet with Zero Balance
    console.log('\n8️⃣ Initializing clean wallet with 0 balance...');
    await prisma.wallet.create({
      data: {
        userId: adminUser.id,
        distributorId: adminProfile.id,
        balance: 0,
        pendingBalance: 0,
        currency: 'INR',
      },
    });

    // 9. Post-Reset Audit Verification
    console.log('\n9️⃣ Running post-reset integrity verification...');
    const userCount = await prisma.user.count();
    const profileCount = await prisma.distributorProfile.count();
    const nodeCount = await prisma.mLMNode.count();
    const orderCount = await prisma.order.count();
    const commissionCount = await prisma.commission.count();
    const bvCount = await prisma.bVLedger.count();

    console.log('   ----------------------------------------');
    console.log(`   Users:                 ${userCount} (Expected: 1)`);
    console.log(`   Distributor Profiles:  ${profileCount} (Expected: 1)`);
    console.log(`   MLM Nodes:             ${nodeCount} (Expected: 1 - Root only)`);
    console.log(`   Orders:                ${orderCount} (Expected: 0)`);
    console.log(`   Commissions:           ${commissionCount} (Expected: 0)`);
    console.log(`   BV Ledgers:            ${bvCount} (Expected: 0)`);
    console.log('   ----------------------------------------');

    if (userCount !== 1 || profileCount !== 1 || nodeCount !== 1 || orderCount !== 0 || commissionCount !== 0 || bvCount !== 0) {
      throw new Error('Integrity check failed: Unexpected row counts after reset.');
    }

    console.log('\n===============================================================');
    console.log('✨ FRESH PRODUCTION INITIALIZATION COMPLETE!');
    console.log('===============================================================');
    console.log(`Super Admin Email:         ${adminEmail}`);
    console.log(`Super Admin Referral Code: ${referralCode}`);
    console.log(`Super Admin Password:      ${adminPassword.replace(/./g, '*')}`);
    console.log('All calculations, volumes, and downlines reset to ZERO.');
    console.log('===============================================================\n');

    return {
      success: true,
      adminEmail,
      referralCode,
      userCount,
      clearedTables: APPLICATION_DATA_TABLES,
    };
  }
}
