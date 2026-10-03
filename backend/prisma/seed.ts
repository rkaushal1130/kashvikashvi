import { PrismaClient, Prisma } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting Kashvimlm Realistic Development Seeding...');

  // ==========================================
  // 1. Roles
  // ==========================================
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with root authority',
      permissions: { all: true, root: true },
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'System Administrator with operational access',
      permissions: { all: true },
    },
  });

  const distributorRole = await prisma.role.upsert({
    where: { name: 'DISTRIBUTOR' },
    update: {},
    create: {
      name: 'DISTRIBUTOR',
      description: 'Independent Business Owner / Distributor',
      permissions: { portal: true, businessCenter: true, wallet: true },
    },
  });

  const customerRole = await prisma.role.upsert({
    where: { name: 'CUSTOMER' },
    update: {},
    create: {
      name: 'CUSTOMER',
      description: 'Retail or Preferred Customer',
      permissions: { shop: true, orderHistory: true },
    },
  });

  const supportRole = await prisma.role.upsert({
    where: { name: 'SUPPORT' },
    update: {},
    create: {
      name: 'SUPPORT',
      description: 'Customer Support and Ticket Agent',
      permissions: { tickets: true, viewMembers: true },
    },
  });

  // ==========================================
  // 2. Compensation Ranks
  // ==========================================
  const rankBronze = await prisma.rank.upsert({
    where: { rankCode: 'RANK_BRONZE' },
    update: {},
    create: {
      rankCode: 'RANK_BRONZE',
      name: 'Bronze',
      level: 1,
      minPersonalBV: new Prisma.Decimal('100.00'),
      minGroupBV: new Prisma.Decimal('500.00'),
      minActiveLegs: 2,
      binaryWeeklyCap: new Prisma.Decimal('1000.00'),
      oneTimeBonus: new Prisma.Decimal('50.00'),
    },
  });

  const rankSilver = await prisma.rank.upsert({
    where: { rankCode: 'RANK_SILVER' },
    update: {},
    create: {
      rankCode: 'RANK_SILVER',
      name: 'Silver',
      level: 2,
      minPersonalBV: new Prisma.Decimal('150.00'),
      minGroupBV: new Prisma.Decimal('2500.00'),
      minActiveLegs: 2,
      binaryWeeklyCap: new Prisma.Decimal('3000.00'),
      oneTimeBonus: new Prisma.Decimal('150.00'),
    },
  });

  const rankGold = await prisma.rank.upsert({
    where: { rankCode: 'RANK_GOLD' },
    update: {},
    create: {
      rankCode: 'RANK_GOLD',
      name: 'Gold',
      level: 3,
      minPersonalBV: new Prisma.Decimal('200.00'),
      minGroupBV: new Prisma.Decimal('10000.00'),
      minActiveLegs: 2,
      binaryWeeklyCap: new Prisma.Decimal('10000.00'),
      oneTimeBonus: new Prisma.Decimal('500.00'),
    },
  });

  const rankPlatinum = await prisma.rank.upsert({
    where: { rankCode: 'RANK_PLATINUM' },
    update: {},
    create: {
      rankCode: 'RANK_PLATINUM',
      name: 'Platinum',
      level: 4,
      minPersonalBV: new Prisma.Decimal('300.00'),
      minGroupBV: new Prisma.Decimal('50000.00'),
      minActiveLegs: 4,
      binaryWeeklyCap: new Prisma.Decimal('25000.00'),
      oneTimeBonus: new Prisma.Decimal('1500.00'),
    },
  });

  const rankDiamond = await prisma.rank.upsert({
    where: { rankCode: 'RANK_DIAMOND' },
    update: {},
    create: {
      rankCode: 'RANK_DIAMOND',
      name: 'Diamond',
      level: 5,
      minPersonalBV: new Prisma.Decimal('500.00'),
      minGroupBV: new Prisma.Decimal('200000.00'),
      minActiveLegs: 4,
      binaryWeeklyCap: new Prisma.Decimal('100000.00'),
      oneTimeBonus: new Prisma.Decimal('5000.00'),
    },
  });

  // ==========================================
  // 2B. Configurable MLM Levels (Prompt 5 Final Requirements)
  // ==========================================
  const mlmLevels = [
    {
      name: 'Silver',
      code: 'SILVER',
      order: 1,
      requiredBB: '250.00',
      requiredLeftMatching: '2000.00',
      requiredRightMatching: '2000.00',
      requiredMatching: '2000.00',
    },
    {
      name: 'Gold',
      code: 'GOLD',
      order: 2,
      requiredBB: '250.00',
      requiredLeftMatching: '5000.00',
      requiredRightMatching: '5000.00',
      requiredMatching: '5000.00',
    },
    {
      name: 'Platinum',
      code: 'PLATINUM',
      order: 3,
      requiredBB: '500.00',
      requiredLeftMatching: '50000.00',
      requiredRightMatching: '50000.00',
      requiredMatching: '50000.00',
    },
    {
      name: 'Diamond',
      code: 'DIAMOND',
      order: 4,
      requiredBB: '1000.00',
      requiredLeftMatching: '60000.00',
      requiredRightMatching: '60000.00',
      requiredMatching: '60000.00',
    },
    {
      name: 'Ruby',
      code: 'RUBY',
      order: 5,
      requiredBB: '1000.00',
      requiredLeftMatching: '100000.00',
      requiredRightMatching: '100000.00',
      requiredMatching: '100000.00',
    },
  ];

  for (const lvl of mlmLevels) {
    await prisma.level.upsert({
      where: { code: lvl.code },
      update: {
        name: lvl.name,
        order: lvl.order,
        requiredBB: new Prisma.Decimal(lvl.requiredBB),
        requiredLeftMatching: new Prisma.Decimal(lvl.requiredLeftMatching),
        requiredRightMatching: new Prisma.Decimal(lvl.requiredRightMatching),
        requiredMatching: new Prisma.Decimal(lvl.requiredMatching),
        isActive: true,
      },
      create: {
        name: lvl.name,
        code: lvl.code,
        order: lvl.order,
        requiredBB: new Prisma.Decimal(lvl.requiredBB),
        requiredLeftMatching: new Prisma.Decimal(lvl.requiredLeftMatching),
        requiredRightMatching: new Prisma.Decimal(lvl.requiredRightMatching),
        requiredMatching: new Prisma.Decimal(lvl.requiredMatching),
        isActive: true,
      },
    });
  }

  // ==========================================
  // 3. Commission Rules
  // ==========================================
  const binaryRule = await prisma.commissionRule.upsert({
    where: { ruleCode: 'BINARY_TEAM_MATCH_10' },
    update: {},
    create: {
      ruleCode: 'BINARY_TEAM_MATCH_10',
      name: 'Binary Team Matching Commission (10%)',
      type: 'BINARY',
      percentage: new Prisma.Decimal('10.00'),
      minPersonalBV: new Prisma.Decimal('100.00'),
      minGroupBV: new Prisma.Decimal('300.00'),
      maxPayoutCap: new Prisma.Decimal('100000.00'),
      isActive: true,
      parameters: { matchRatio: '1:1', cycleThreshold: 300 },
    },
  });

  const referralRule = await prisma.commissionRule.upsert({
    where: { ruleCode: 'DIRECT_REFERRAL_20' },
    update: {},
    create: {
      ruleCode: 'DIRECT_REFERRAL_20',
      name: 'Direct Sponsor Fast Start Bonus (20%)',
      type: 'FRONTLINE',
      percentage: new Prisma.Decimal('20.00'),
      minPersonalBV: new Prisma.Decimal('50.00'),
      isActive: true,
      parameters: { appliesToFirstOrderOnly: true },
    },
  });

  const rankBonusRule = await prisma.commissionRule.upsert({
    where: { ruleCode: 'MILESTONE_RANK_BONUS' },
    update: {},
    create: {
      ruleCode: 'MILESTONE_RANK_BONUS',
      name: 'Rank Advancement Milestone Bonus',
      type: 'RANK',
      minPersonalBV: new Prisma.Decimal('100.00'),
      isActive: true,
    },
  });

  const volumeBoosterRule = await prisma.commissionRule.upsert({
    where: { ruleCode: 'VOLUME_BOOSTER_1000_10' },
    update: {},
    create: {
      ruleCode: 'VOLUME_BOOSTER_1000_10',
      name: 'High Volume Booster Bonus (10% over 1,000 BV)',
      type: 'BASE',
      percentage: new Prisma.Decimal('10.00'),
      minPersonalBV: new Prisma.Decimal('1000.00'),
      isActive: true,
      configurationJson: {
        minBV: 1000,
        percentage: 10,
        description: '10% volume booster commission on volume exceeding 1,000 BV',
      },
    },
  });

  // ==========================================
  // 4. ADMIN: admin@example.com
  // ==========================================
  const adminPassword = await hashPassword('AdminPassword@2026');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash: adminPassword,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      isActive: true,
    },
    create: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      roleId: adminRole.id,
      roleName: 'ADMIN',
      phone: '+1-555-0100',
      isActive: true,
      emailVerifiedAt: new Date(),
      securityProfile: {
        create: {
          twoFactorEnabled: false,
        },
      },
    },
  });

  // Also support agent user if present
  await prisma.user.upsert({
    where: { email: 'support@example.com' },
    update: {},
    create: {
      email: 'support@example.com',
      passwordHash: adminPassword,
      roleId: supportRole.id,
      roleName: 'SUPPORT',
      phone: '+1-555-0109',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  // ==========================================
  // 5. DISTRIBUTOR: Rahul Example (KV-DEMO-1001)
  // ==========================================
  const distPassword = await hashPassword('DistributorPass123!');
  const rahulUser = await prisma.user.upsert({
    where: { email: 'rahul.example@example.com' },
    update: {
      passwordHash: distPassword,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      isActive: true,
    },
    create: {
      email: 'rahul.example@example.com',
      passwordHash: distPassword,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      phone: '+1-555-0101',
      isActive: true,
      emailVerifiedAt: new Date(),
      wallet: {
        create: {
          balance: new Prisma.Decimal('720.00'),
          availableBalance: new Prisma.Decimal('720.00'),
          pendingBalance: new Prisma.Decimal('0.00'),
          totalEarned: new Prisma.Decimal('4870.00'),
          lifetimeEarned: new Prisma.Decimal('4870.00'),
          totalWithdrawn: new Prisma.Decimal('4150.00'),
          lifetimePaid: new Prisma.Decimal('4150.00'),
          currency: 'USD',
        },
      },
      securityProfile: {
        create: {
          twoFactorEnabled: false,
        },
      },
    },
  });

  const rahulDistributor = await prisma.distributorProfile.upsert({
    where: { distributorCode: 'KV-1001' },
    update: {
      distributorId: 'KV-1001',
      firstName: 'Rahul',
      lastName: 'Kaushal',
      displayName: 'Rahul Kaushal',
      status: 'ACTIVE',
      currentRankId: rankGold.id,
      highestRankId: rankGold.id,
      rankId: rankGold.id,
    },
    create: {
      userId: rahulUser.id,
      distributorId: 'KV-1001',
      distributorCode: 'KV-1001',
      firstName: 'Rahul',
      lastName: 'Kaushal',
      displayName: 'Rahul Kaushal',
      status: 'ACTIVE',
      currentRankId: rankGold.id,
      highestRankId: rankGold.id,
      rankId: rankGold.id,
      lifetimePV: new Prisma.Decimal('1500.00'),
      lifetimeGV: new Prisma.Decimal('45000.00'),
      activatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });

  // Replicated Storefront for Rahul Example
  await prisma.distributorWebsite.upsert({
    where: { distributorId: rahulDistributor.id },
    update: {},
    create: {
      distributorId: rahulDistributor.id,
      slug: 'rahul-example',
      subdomain: 'rahul',
      title: "Rahul's Kashvi Wellness Store",
      description: 'Official representative for Kashvi organic hosiery, wellness, and smart devices.',
      theme: 'EMERALD',
      isPublished: true,
      contactEmail: 'rahul.example@example.com',
      contactPhone: '+1-555-0101',
      links: {
        create: [
          { label: 'Shop Apparel & Devices', url: '/products', type: 'SHOP', sortOrder: 1 },
          { label: 'Join My Global Team', url: '/enroll?sponsor=KV-DEMO-1001', type: 'ENROLL', sortOrder: 2 },
        ],
      },
    },
  });

  let rahulBankAccount = await prisma.bankAccount.findFirst({
    where: { distributorId: rahulDistributor.id },
  });
  if (!rahulBankAccount) {
    rahulBankAccount = await prisma.bankAccount.create({
      data: {
        distributorId: rahulDistributor.id,
        bankName: 'JPMorgan Chase Bank',
        accountHolderName: 'Rahul Kaushal',
        accountNumber: '987654321098',
        routingNumber: '021000021',
        status: 'VERIFIED',
        isPrimary: true,
      },
    });
  }

  // ==========================================
  // 6. 3 Business Centers for Rahul (KV-1001)
  // ==========================================
  const rahulBC1 = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-1001-BC1' },
    update: {
      leftVolume: new Prisma.Decimal('14500.00'),
      rightVolume: new Prisma.Decimal('11200.00'),
      accumulatedLeftVolume: new Prisma.Decimal('28000.00'),
      accumulatedRightVolume: new Prisma.Decimal('24500.00'),
    },
    create: {
      distributorId: rahulDistributor.id,
      centerNumber: 1,
      centerCode: 'KV-1001-BC1',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('14500.00'),
      rightVolume: new Prisma.Decimal('11200.00'),
      accumulatedLeftVolume: new Prisma.Decimal('28000.00'),
      accumulatedRightVolume: new Prisma.Decimal('24500.00'),
    },
  });

  const rahulBC2 = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-1001-BC2' },
    update: {
      leftVolume: new Prisma.Decimal('6200.00'),
      rightVolume: new Prisma.Decimal('5400.00'),
      accumulatedLeftVolume: new Prisma.Decimal('12000.00'),
      accumulatedRightVolume: new Prisma.Decimal('10500.00'),
    },
    create: {
      distributorId: rahulDistributor.id,
      centerNumber: 2,
      centerCode: 'KV-1001-BC2',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('6200.00'),
      rightVolume: new Prisma.Decimal('5400.00'),
      accumulatedLeftVolume: new Prisma.Decimal('12000.00'),
      accumulatedRightVolume: new Prisma.Decimal('10500.00'),
    },
  });

  const rahulBC3 = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-1001-BC3' },
    update: {
      leftVolume: new Prisma.Decimal('3800.00'),
      rightVolume: new Prisma.Decimal('3100.00'),
      accumulatedLeftVolume: new Prisma.Decimal('7500.00'),
      accumulatedRightVolume: new Prisma.Decimal('6200.00'),
    },
    create: {
      distributorId: rahulDistributor.id,
      centerNumber: 3,
      centerCode: 'KV-1001-BC3',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('3800.00'),
      rightVolume: new Prisma.Decimal('3100.00'),
      accumulatedLeftVolume: new Prisma.Decimal('7500.00'),
      accumulatedRightVolume: new Prisma.Decimal('6200.00'),
    },
  });

  // Root Node in Binary Tree for Rahul (KV-1001) BC1
  const rootNode = await prisma.mLMNode.upsert({
    where: { businessCenterId: rahulBC1.id },
    update: {},
    create: {
      businessCenterId: rahulBC1.id,
      distributorId: rahulDistributor.id,
      depth: 0,
      binaryPath: 'ROOT',
    },
  });


  // ==========================================
  // 7. PREFERRED CUSTOMER: customer@example.com
  // ==========================================
  const custPassword = await hashPassword('CustomerPass123!');
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {
      passwordHash: custPassword,
      roleId: customerRole.id,
      roleName: 'CUSTOMER',
      isActive: true,
    },
    create: {
      email: 'customer@example.com',
      passwordHash: custPassword,
      roleId: customerRole.id,
      roleName: 'CUSTOMER',
      phone: '+1-555-0104',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const preferredCustomer = await prisma.customer.upsert({
    where: { customerCode: 'CUST-20001' },
    update: {
      sponsorId: rahulDistributor.id,
      isPreferred: true,
    },
    create: {
      userId: customerUser.id,
      customerCode: 'CUST-20001',
      sponsorId: rahulDistributor.id,
      isPreferred: true,
    },
  });

  // Customer Shipping Address
  const customerAddress = await prisma.address.upsert({
    where: { id: 'cust-addr-demo-01' },
    update: {},
    create: {
      id: 'cust-addr-demo-01',
      userId: customerUser.id,
      type: 'SHIPPING',
      isDefault: true,
      recipientName: 'Preferred Customer',
      streetAddress: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'USA',
    },
  });

  // ==========================================
  // 8. Sample Binary Tree Downline Nodes (A, B, C, D, E, F)
  //
  //               Demo Distributor (Rahul)
  //               /                      \
  //        Distributor A            Distributor B
  //          /        \               /        \
  //         C          D             E          F
  // ==========================================
  interface TreeMemberSpec {
    code: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    rankId: string;
    sponsorId: string;
    parentBCId: string;
    position: 'LEFT' | 'RIGHT';
    depth: number;
    binaryPath: string;
    leftVol: string;
    rightVol: string;
    walletBalance: string;
  }

  // --- Distributor A (Left Child of Demo Distributor) ---
  const userA = await prisma.user.upsert({
    where: { email: 'distributor.a@example.com' },
    update: {},
    create: {
      email: 'distributor.a@example.com',
      passwordHash: distPassword,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      phone: '+1-555-0102',
      isActive: true,
      wallet: {
        create: {
          balance: new Prisma.Decimal('450.00'),
          availableBalance: new Prisma.Decimal('450.00'),
          totalEarned: new Prisma.Decimal('1850.00'),
          totalWithdrawn: new Prisma.Decimal('1400.00'),
        },
      },
    },
  });

  const distA = await prisma.distributorProfile.upsert({
    where: { distributorCode: 'KV-1002' },
    update: {
      distributorId: 'KV-1002',
      firstName: 'Amit',
      lastName: 'Verma',
      displayName: 'Amit Verma',
      status: 'ACTIVE',
      sponsorId: rahulDistributor.id,
      currentRankId: rankSilver.id,
      highestRankId: rankSilver.id,
      rankId: rankSilver.id,
    },
    create: {
      userId: userA.id,
      distributorId: 'KV-1002',
      distributorCode: 'KV-1002',
      firstName: 'Amit',
      lastName: 'Verma',
      displayName: 'Amit Verma',
      status: 'ACTIVE',
      sponsorId: rahulDistributor.id,
      currentRankId: rankSilver.id,
      highestRankId: rankSilver.id,
      rankId: rankSilver.id,
      lifetimePV: new Prisma.Decimal('600.00'),
      lifetimeGV: new Prisma.Decimal('18000.00'),
      activatedAt: new Date('2026-01-10T00:00:00Z'),
    },
  });

  const bcA = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-1002-BC1' },
    update: {},
    create: {
      distributorId: distA.id,
      centerNumber: 1,
      centerCode: 'KV-1002-BC1',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('6200.00'),
      rightVolume: new Prisma.Decimal('5800.00'),
      accumulatedLeftVolume: new Prisma.Decimal('12400.00'),
      accumulatedRightVolume: new Prisma.Decimal('11600.00'),
    },
  });

  const nodeA = await prisma.mLMNode.upsert({
    where: { businessCenterId: bcA.id },
    update: {},
    create: {
      businessCenterId: bcA.id,
      distributorId: distA.id,
      placementParentId: rootNode.id,
      placementPosition: 'LEFT',
      depth: 1,
      binaryPath: 'ROOT/L',
    },
  });

  await prisma.sponsorRelationship.upsert({
    where: {
      ancestorId_descendantId: { ancestorId: rahulDistributor.id, descendantId: distA.id },
    },
    update: {},
    create: { ancestorId: rahulDistributor.id, descendantId: distA.id, depth: 1, isDirect: true },
  });

  // --- Distributor B (Right Child of Demo Distributor) ---
  const userB = await prisma.user.upsert({
    where: { email: 'distributor.b@example.com' },
    update: {},
    create: {
      email: 'distributor.b@example.com',
      passwordHash: distPassword,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      phone: '+1-555-0103',
      isActive: true,
      wallet: {
        create: {
          balance: new Prisma.Decimal('380.00'),
          availableBalance: new Prisma.Decimal('380.00'),
          totalEarned: new Prisma.Decimal('1420.00'),
          totalWithdrawn: new Prisma.Decimal('1040.00'),
        },
      },
    },
  });

  const distB = await prisma.distributorProfile.upsert({
    where: { distributorCode: 'KV-1003' },
    update: {
      distributorId: 'KV-1003',
      firstName: 'Rohit',
      lastName: 'Singh',
      displayName: 'Rohit Singh',
      status: 'ACTIVE',
      sponsorId: rahulDistributor.id,
      currentRankId: rankSilver.id,
      highestRankId: rankSilver.id,
      rankId: rankSilver.id,
    },
    create: {
      userId: userB.id,
      distributorId: 'KV-1003',
      distributorCode: 'KV-1003',
      firstName: 'Rohit',
      lastName: 'Singh',
      displayName: 'Rohit Singh',
      status: 'ACTIVE',
      sponsorId: rahulDistributor.id,
      currentRankId: rankSilver.id,
      highestRankId: rankSilver.id,
      rankId: rankSilver.id,
      lifetimePV: new Prisma.Decimal('500.00'),
      lifetimeGV: new Prisma.Decimal('15000.00'),
      activatedAt: new Date('2026-01-12T00:00:00Z'),
    },
  });

  const bcB = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-1003-BC1' },
    update: {},
    create: {
      distributorId: distB.id,
      centerNumber: 1,
      centerCode: 'KV-1003-BC1',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('5100.00'),
      rightVolume: new Prisma.Decimal('4800.00'),
      accumulatedLeftVolume: new Prisma.Decimal('10200.00'),
      accumulatedRightVolume: new Prisma.Decimal('9600.00'),
    },
  });

  const nodeB = await prisma.mLMNode.upsert({
    where: { businessCenterId: bcB.id },
    update: {},
    create: {
      businessCenterId: bcB.id,
      distributorId: distB.id,
      placementParentId: rootNode.id,
      placementPosition: 'RIGHT',
      depth: 1,
      binaryPath: 'ROOT/R',
    },
  });

  await prisma.sponsorRelationship.upsert({
    where: {
      ancestorId_descendantId: { ancestorId: rahulDistributor.id, descendantId: distB.id },
    },
    update: {},
    create: { ancestorId: rahulDistributor.id, descendantId: distB.id, depth: 1, isDirect: true },
  });

  // --- Distributor C (Left Child of Distributor A) ---
  const userC = await prisma.user.upsert({
    where: { email: 'distributor.c@example.com' },
    update: {},
    create: {
      email: 'distributor.c@example.com',
      passwordHash: distPassword,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      phone: '+1-555-0105',
      isActive: true,
      wallet: { create: { balance: new Prisma.Decimal('120.00'), availableBalance: new Prisma.Decimal('120.00') } },
    },
  });

  const distC = await prisma.distributorProfile.upsert({
    where: { distributorCode: 'KV-DEMO-1004' },
    update: {
      distributorId: 'KV-DEMO-1004',
      firstName: 'Neha',
      lastName: 'Sharma',
      displayName: 'Neha Sharma',
      status: 'ACTIVE',
      sponsorId: distA.id,
      currentRankId: rankBronze.id,
      highestRankId: rankBronze.id,
      rankId: rankBronze.id,
    },
    create: {
      userId: userC.id,
      distributorId: 'KV-DEMO-1004',
      distributorCode: 'KV-DEMO-1004',
      firstName: 'Neha',
      lastName: 'Sharma',
      displayName: 'Neha Sharma',
      status: 'ACTIVE',
      sponsorId: distA.id,
      currentRankId: rankBronze.id,
      highestRankId: rankBronze.id,
      rankId: rankBronze.id,
      lifetimePV: new Prisma.Decimal('250.00'),
      lifetimeGV: new Prisma.Decimal('4200.00'),
      activatedAt: new Date('2026-02-01T00:00:00Z'),
    },
  });

  const bcC = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-DEMO-1004-BC1' },
    update: {},
    create: {
      distributorId: distC.id,
      centerNumber: 1,
      centerCode: 'KV-DEMO-1004-BC1',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('2100.00'),
      rightVolume: new Prisma.Decimal('1900.00'),
    },
  });

  await prisma.mLMNode.upsert({
    where: { businessCenterId: bcC.id },
    update: {},
    create: {
      businessCenterId: bcC.id,
      distributorId: distC.id,
      placementParentId: nodeA.id,
      placementPosition: 'LEFT',
      depth: 2,
      binaryPath: 'ROOT/L/L',
    },
  });

  await prisma.sponsorRelationship.upsert({
    where: { ancestorId_descendantId: { ancestorId: distA.id, descendantId: distC.id } },
    update: {},
    create: { ancestorId: distA.id, descendantId: distC.id, depth: 1, isDirect: true },
  });
  await prisma.sponsorRelationship.upsert({
    where: { ancestorId_descendantId: { ancestorId: rahulDistributor.id, descendantId: distC.id } },
    update: {},
    create: { ancestorId: rahulDistributor.id, descendantId: distC.id, depth: 2, isDirect: false },
  });

  // --- Distributor D (Right Child of Distributor A) ---
  const userD = await prisma.user.upsert({
    where: { email: 'distributor.d@example.com' },
    update: {},
    create: {
      email: 'distributor.d@example.com',
      passwordHash: distPassword,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      phone: '+1-555-0106',
      isActive: true,
      wallet: { create: { balance: new Prisma.Decimal('95.00'), availableBalance: new Prisma.Decimal('95.00') } },
    },
  });

  const distD = await prisma.distributorProfile.upsert({
    where: { distributorCode: 'KV-DEMO-1005' },
    update: {
      distributorId: 'KV-DEMO-1005',
      firstName: 'Pooja',
      lastName: 'Patel',
      displayName: 'Pooja Patel',
      status: 'ACTIVE',
      sponsorId: distA.id,
      currentRankId: rankBronze.id,
      highestRankId: rankBronze.id,
      rankId: rankBronze.id,
    },
    create: {
      userId: userD.id,
      distributorId: 'KV-DEMO-1005',
      distributorCode: 'KV-DEMO-1005',
      firstName: 'Pooja',
      lastName: 'Patel',
      displayName: 'Pooja Patel',
      status: 'ACTIVE',
      sponsorId: distA.id,
      currentRankId: rankBronze.id,
      highestRankId: rankBronze.id,
      rankId: rankBronze.id,
      lifetimePV: new Prisma.Decimal('200.00'),
      lifetimeGV: new Prisma.Decimal('3800.00'),
      activatedAt: new Date('2026-02-05T00:00:00Z'),
    },
  });

  const bcD = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-DEMO-1005-BC1' },
    update: {},
    create: {
      distributorId: distD.id,
      centerNumber: 1,
      centerCode: 'KV-DEMO-1005-BC1',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('1900.00'),
      rightVolume: new Prisma.Decimal('1750.00'),
    },
  });

  await prisma.mLMNode.upsert({
    where: { businessCenterId: bcD.id },
    update: {},
    create: {
      businessCenterId: bcD.id,
      distributorId: distD.id,
      placementParentId: nodeA.id,
      placementPosition: 'RIGHT',
      depth: 2,
      binaryPath: 'ROOT/L/R',
    },
  });

  await prisma.sponsorRelationship.upsert({
    where: { ancestorId_descendantId: { ancestorId: distA.id, descendantId: distD.id } },
    update: {},
    create: { ancestorId: distA.id, descendantId: distD.id, depth: 1, isDirect: true },
  });
  await prisma.sponsorRelationship.upsert({
    where: { ancestorId_descendantId: { ancestorId: rahulDistributor.id, descendantId: distD.id } },
    update: {},
    create: { ancestorId: rahulDistributor.id, descendantId: distD.id, depth: 2, isDirect: false },
  });

  // --- Distributor E (Left Child of Distributor B) ---
  const userE = await prisma.user.upsert({
    where: { email: 'distributor.e@example.com' },
    update: {},
    create: {
      email: 'distributor.e@example.com',
      passwordHash: distPassword,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      phone: '+1-555-0107',
      isActive: true,
      wallet: { create: { balance: new Prisma.Decimal('180.00'), availableBalance: new Prisma.Decimal('180.00') } },
    },
  });

  const distE = await prisma.distributorProfile.upsert({
    where: { distributorCode: 'KV-DEMO-1006' },
    update: {},
    create: {
      userId: userE.id,
      distributorCode: 'KV-DEMO-1006',
      firstName: 'Edward',
      lastName: 'Taylor',
      displayName: 'Edward Taylor',
      status: 'ACTIVE',
      sponsorId: distB.id,
      currentRankId: rankBronze.id,
      highestRankId: rankBronze.id,
      lifetimePV: new Prisma.Decimal('300.00'),
      lifetimeGV: new Prisma.Decimal('4600.00'),
      activatedAt: new Date('2026-02-10T00:00:00Z'),
    },
  });

  const bcE = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-DEMO-1006-BC1' },
    update: {},
    create: {
      distributorId: distE.id,
      centerNumber: 1,
      centerCode: 'KV-DEMO-1006-BC1',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('2400.00'),
      rightVolume: new Prisma.Decimal('2200.00'),
    },
  });

  await prisma.mLMNode.upsert({
    where: { businessCenterId: bcE.id },
    update: {},
    create: {
      businessCenterId: bcE.id,
      distributorId: distE.id,
      placementParentId: nodeB.id,
      placementPosition: 'LEFT',
      depth: 2,
      binaryPath: 'ROOT/R/L',
    },
  });

  await prisma.sponsorRelationship.upsert({
    where: { ancestorId_descendantId: { ancestorId: distB.id, descendantId: distE.id } },
    update: {},
    create: { ancestorId: distB.id, descendantId: distE.id, depth: 1, isDirect: true },
  });
  await prisma.sponsorRelationship.upsert({
    where: { ancestorId_descendantId: { ancestorId: rahulDistributor.id, descendantId: distE.id } },
    update: {},
    create: { ancestorId: rahulDistributor.id, descendantId: distE.id, depth: 2, isDirect: false },
  });

  // --- Distributor F (Right Child of Distributor B) ---
  const userF = await prisma.user.upsert({
    where: { email: 'distributor.f@example.com' },
    update: {},
    create: {
      email: 'distributor.f@example.com',
      passwordHash: distPassword,
      roleId: distributorRole.id,
      roleName: 'DISTRIBUTOR',
      phone: '+1-555-0108',
      isActive: true,
      wallet: { create: { balance: new Prisma.Decimal('140.00'), availableBalance: new Prisma.Decimal('140.00') } },
    },
  });

  const distF = await prisma.distributorProfile.upsert({
    where: { distributorCode: 'KV-DEMO-1007' },
    update: {},
    create: {
      userId: userF.id,
      distributorCode: 'KV-DEMO-1007',
      firstName: 'Fiona',
      lastName: 'Gallagher',
      displayName: 'Fiona Gallagher',
      status: 'ACTIVE',
      sponsorId: distB.id,
      currentRankId: rankBronze.id,
      highestRankId: rankBronze.id,
      lifetimePV: new Prisma.Decimal('280.00'),
      lifetimeGV: new Prisma.Decimal('4300.00'),
      activatedAt: new Date('2026-02-12T00:00:00Z'),
    },
  });

  const bcF = await prisma.businessCenter.upsert({
    where: { centerCode: 'KV-DEMO-1007-BC1' },
    update: {},
    create: {
      distributorId: distF.id,
      centerNumber: 1,
      centerCode: 'KV-DEMO-1007-BC1',
      status: 'ACTIVE',
      leftVolume: new Prisma.Decimal('2200.00'),
      rightVolume: new Prisma.Decimal('2100.00'),
    },
  });

  await prisma.mLMNode.upsert({
    where: { businessCenterId: bcF.id },
    update: {},
    create: {
      businessCenterId: bcF.id,
      distributorId: distF.id,
      placementParentId: nodeB.id,
      placementPosition: 'RIGHT',
      depth: 2,
      binaryPath: 'ROOT/R/R',
    },
  });

  await prisma.sponsorRelationship.upsert({
    where: { ancestorId_descendantId: { ancestorId: distB.id, descendantId: distF.id } },
    update: {},
    create: { ancestorId: distB.id, descendantId: distF.id, depth: 1, isDirect: true },
  });
  await prisma.sponsorRelationship.upsert({
    where: { ancestorId_descendantId: { ancestorId: rahulDistributor.id, descendantId: distF.id } },
    update: {},
    create: { ancestorId: rahulDistributor.id, descendantId: distF.id, depth: 2, isDirect: false },
  });

  // ==========================================
  // 9. 2 Categories:
  //    - Clothes & Hosiery
  //    - Electronics & Smart Devices
  // ==========================================
  const catClothesHosiery = await prisma.productCategory.upsert({
    where: { slug: 'clothes-hosiery' },
    update: { categoryCode: 'CLOTHES_HOSIERY', name: 'Clothes & Hosiery' },
    create: {
      categoryCode: 'CLOTHES_HOSIERY',
      name: 'Clothes & Hosiery',
      slug: 'clothes-hosiery',
      description: 'Premium combed cotton apparel, activewear, thermal base layers, and therapeutic compression hosiery',
      isActive: true,
      displayOrder: 1,
    },
  });

  const catElectronics = await prisma.productCategory.upsert({
    where: { slug: 'electronics-smart-devices' },
    update: { categoryCode: 'ELECTRONICS_SMART_DEVICES', name: 'Electronics & Smart Devices' },
    create: {
      categoryCode: 'ELECTRONICS_SMART_DEVICES',
      name: 'Electronics & Smart Devices',
      slug: 'electronics-smart-devices',
      description: 'Smart wearables, health tracking monitors, bio-impedance scales, and IoT wellness devices',
      isActive: true,
      displayOrder: 2,
    },
  });

  // ==========================================
  // 10. 8 Products with Realistic Pricing, BV & Stock:
  //     1. Men's Cotton Hosiery T-Shirt
  //     2. Hosiery Innerwear
  //     3. Bamboo Socks
  //     4. Hoodie
  //     5. Smart Watch
  //     6. Bluetooth Earbuds
  //     7. Power Bank
  //     8. Smart Device
  // ==========================================
  interface ProductSpec {
    sku: string;
    name: string;
    slug: string;
    description: string;
    categoryId: string;
    mrp: string;
    retailPrice: string;
    distributorPrice: string;
    wholesalePrice: string;
    bv: string;
    stock: number;
    lowStockThreshold: number;
    imageUrl: string;
    altText: string;
    isFeatured: boolean;
  }

  const productsList: ProductSpec[] = [
    // 1. Men's Cotton Hosiery T-Shirt
    {
      sku: 'CLO-TSHIRT-001',
      name: "Men's Cotton Hosiery T-Shirt",
      slug: 'mens-cotton-hosiery-t-shirt',
      description: 'Ultra-soft combed 100% organic cotton hosiery t-shirt with reinforced crew neck, breathable weave, and anti-shrink finish.',
      categoryId: catClothesHosiery.id,
      mrp: '49.99',
      retailPrice: '39.99',
      distributorPrice: '29.99',
      wholesalePrice: '24.99',
      bv: '20.00',
      stock: 650,
      lowStockThreshold: 50,
      imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
      altText: "Men's Cotton Hosiery T-Shirt",
      isFeatured: true,
    },
    // 2. Hosiery Innerwear
    {
      sku: 'CLO-INNER-001',
      name: 'Hosiery Innerwear',
      slug: 'hosiery-innerwear',
      description: 'Seamless microfiber moisture-wicking hosiery innerwear offering feather-light comfort, contour fit, and antibacterial odor control.',
      categoryId: catClothesHosiery.id,
      mrp: '34.99',
      retailPrice: '29.99',
      distributorPrice: '21.99',
      wholesalePrice: '18.99',
      bv: '15.00',
      stock: 800,
      lowStockThreshold: 60,
      imageUrl: 'https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=800&q=80',
      altText: 'Premium Hosiery Innerwear',
      isFeatured: false,
    },
    // 3. Bamboo Socks
    {
      sku: 'CLO-SOCKS-001',
      name: 'Bamboo Socks',
      slug: 'bamboo-socks',
      description: 'Naturally hypoallergenic and thermoregulating bamboo fiber socks with cushioned arch support, seamless toe closure, and blister prevention.',
      categoryId: catClothesHosiery.id,
      mrp: '19.99',
      retailPrice: '16.99',
      distributorPrice: '11.99',
      wholesalePrice: '9.99',
      bv: '8.00',
      stock: 1200,
      lowStockThreshold: 100,
      imageUrl: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=800&q=80',
      altText: 'Thermoregulating Bamboo Socks',
      isFeatured: false,
    },
    // 4. Hoodie
    {
      sku: 'CLO-HOODIE-001',
      name: 'Hoodie',
      slug: 'hoodie',
      description: 'Heavyweight French terry cotton fleece hoodie with double-layer hood, kangaroo pocket, ribbed hems, and tailored athletic silhouette.',
      categoryId: catClothesHosiery.id,
      mrp: '79.99',
      retailPrice: '69.99',
      distributorPrice: '49.99',
      wholesalePrice: '44.99',
      bv: '35.00',
      stock: 450,
      lowStockThreshold: 30,
      imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
      altText: 'Premium Cotton Fleece Hoodie',
      isFeatured: true,
    },
    // 5. Smart Watch
    {
      sku: 'ELE-WATCH-001',
      name: 'Smart Watch',
      slug: 'smart-watch',
      description: 'Next-gen AMOLED touchscreen smartwatch with ECG heart monitoring, blood oxygen SpO2, sleep tracking, 5ATM water resistance, and GPS.',
      categoryId: catElectronics.id,
      mrp: '149.99',
      retailPrice: '129.99',
      distributorPrice: '99.99',
      wholesalePrice: '89.99',
      bv: '75.00',
      stock: 300,
      lowStockThreshold: 25,
      imageUrl: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=800&q=80',
      altText: 'Next-Gen AMOLED Smart Watch',
      isFeatured: true,
    },
    // 6. Bluetooth Earbuds
    {
      sku: 'ELE-EARBUD-001',
      name: 'Bluetooth Earbuds',
      slug: 'bluetooth-earbuds',
      description: 'Active Noise Cancelling (ANC) true wireless stereo earbuds with dynamic graphene drivers, 36-hour playback case, and IPX7 sweatproof rating.',
      categoryId: catElectronics.id,
      mrp: '89.99',
      retailPrice: '79.99',
      distributorPrice: '54.99',
      wholesalePrice: '49.99',
      bv: '40.00',
      stock: 500,
      lowStockThreshold: 40,
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
      altText: 'Active Noise Cancelling Bluetooth Earbuds',
      isFeatured: true,
    },
    // 7. Power Bank
    {
      sku: 'ELE-PWRBNK-001',
      name: 'Power Bank',
      slug: 'power-bank',
      description: '20,000mAh Ultra-Slim Fast Charging Power Bank with 65W Power Delivery (PD 3.0), Quick Charge 4+, dual USB-C ports, and smart LED status display.',
      categoryId: catElectronics.id,
      mrp: '59.99',
      retailPrice: '49.99',
      distributorPrice: '36.99',
      wholesalePrice: '32.99',
      bv: '25.00',
      stock: 600,
      lowStockThreshold: 45,
      imageUrl: 'https://images.unsplash.com/photo-1609592424364-7efc9e78a65a?auto=format&fit=crop&w=800&q=80',
      altText: '20000mAh Fast Charging Power Bank',
      isFeatured: false,
    },
    // 8. Smart Device
    {
      sku: 'ELE-SMTDEV-001',
      name: 'Smart Device',
      slug: 'smart-device',
      description: 'Multi-Sensor Smart Home Air & Ambient Wellness Monitor with real-time PM2.5, VOC, humidity, temperature detection, and WiFi companion app.',
      categoryId: catElectronics.id,
      mrp: '119.99',
      retailPrice: '99.99',
      distributorPrice: '74.99',
      wholesalePrice: '64.99',
      bv: '50.00',
      stock: 350,
      lowStockThreshold: 30,
      imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80',
      altText: 'Smart Ambient Wellness Environmental Monitor',
      isFeatured: false,
    },
  ];

  const createdProducts: Record<string, any> = {};

  for (const item of productsList) {
    const prod = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        categoryId: item.categoryId,
        mrp: new Prisma.Decimal(item.mrp),
        retailPrice: new Prisma.Decimal(item.retailPrice),
        distributorPrice: new Prisma.Decimal(item.distributorPrice),
        wholesalePrice: new Prisma.Decimal(item.wholesalePrice),
        bv: new Prisma.Decimal(item.bv),
        stock: item.stock,
        lowStockThreshold: item.lowStockThreshold,
        status: 'ACTIVE',
        isFeatured: item.isFeatured,
      },
      create: {
        sku: item.sku,
        name: item.name,
        slug: item.slug,
        description: item.description,
        categoryId: item.categoryId,
        mrp: new Prisma.Decimal(item.mrp),
        retailPrice: new Prisma.Decimal(item.retailPrice),
        distributorPrice: new Prisma.Decimal(item.distributorPrice),
        wholesalePrice: new Prisma.Decimal(item.wholesalePrice),
        bv: new Prisma.Decimal(item.bv),
        stock: item.stock,
        lowStockThreshold: item.lowStockThreshold,
        status: 'ACTIVE',
        isFeatured: item.isFeatured,
        images: {
          create: [
            {
              url: item.imageUrl,
              altText: item.altText,
              isPrimary: true,
              displayOrder: 0,
            },
          ],
        },
        inventory: {
          create: {
            quantityOnHand: item.stock,
            quantityReserved: 5,
            reorderThreshold: item.lowStockThreshold,
          },
        },
      },
    });
    createdProducts[item.sku] = prod;
  }

  // ==========================================
  // 11. Sample Commission Periods:
  //     - Closed / Paid: W-2026-37
  //     - Active / Open: W-2026-38
  // ==========================================
  const periodW37 = await prisma.commissionPeriod.upsert({
    where: { periodCode: 'W-2026-37' },
    update: {},
    create: {
      periodCode: 'W-2026-37',
      startDate: new Date('2026-09-08T00:00:00Z'),
      endDate: new Date('2026-09-14T23:59:59Z'),
      status: 'CLOSED',
      processedAt: new Date('2026-09-15T02:00:00Z'),
      lockedAt: new Date('2026-09-15T01:00:00Z'),
      finalizedAt: new Date('2026-09-15T03:00:00Z'),
      totalCommissionsCalculated: new Prisma.Decimal('1250.00'),
      totalBVProcessed: new Prisma.Decimal('12500.00'),
    },
  });

  const periodW38 = await prisma.commissionPeriod.upsert({
    where: { periodCode: 'W-2026-38' },
    update: {},
    create: {
      periodCode: 'W-2026-38',
      startDate: new Date('2026-09-15T00:00:00Z'),
      endDate: new Date('2026-09-21T23:59:59Z'),
      status: 'OPEN',
      totalCommissionsCalculated: new Prisma.Decimal('0.00'),
      totalBVProcessed: new Prisma.Decimal('4500.00'),
    },
  });

  // ==========================================
  // 12. Sample Orders & OrderItems
  // ==========================================
  // Order 1: Preferred Customer Order
  const order1 = await prisma.order.upsert({
    where: { orderNumber: 'ORD-2026-10001' },
    update: {},
    create: {
      orderNumber: 'ORD-2026-10001',
      userId: customerUser.id,
      customerId: preferredCustomer.id,
      distributorId: rahulDistributor.id, // Direct retail sponsor
      status: 'DELIVERED',
      subtotal: new Prisma.Decimal('96.97'),
      taxAmount: new Prisma.Decimal('7.76'),
      shippingAmount: new Prisma.Decimal('5.00'),
      discountAmount: new Prisma.Decimal('0.00'),
      totalAmount: new Prisma.Decimal('109.73'),
      totalBV: new Prisma.Decimal('48.00'),
      shippingAddressId: customerAddress.id,
      trackingNumber: 'TRK-USPS-984210',
      paidAt: new Date('2026-09-10T14:30:00Z'),
      items: {
        create: [
          {
            productId: createdProducts['CLO-TSHIRT-001'].id,
            quantity: 2,
            unitPrice: new Prisma.Decimal('39.99'),
            unitBV: new Prisma.Decimal('20.00'),
            totalPrice: new Prisma.Decimal('79.98'),
            totalBV: new Prisma.Decimal('40.00'),
          },
          {
            productId: createdProducts['CLO-SOCKS-001'].id,
            quantity: 1,
            unitPrice: new Prisma.Decimal('16.99'),
            unitBV: new Prisma.Decimal('8.00'),
            totalPrice: new Prisma.Decimal('16.99'),
            totalBV: new Prisma.Decimal('8.00'),
          },
        ],
      },
      payments: {
        create: [
          {
            paymentNumber: 'PAY-10001',
            method: 'CREDIT_CARD',
            status: 'COMPLETED',
            amount: new Prisma.Decimal('109.73'),
            currency: 'USD',
            paidAt: new Date('2026-09-10T14:30:00Z'),
          },
        ],
      },
    },
  });

  // Order 2: Distributor A (Left Leg) Purchase
  const order2 = await prisma.order.upsert({
    where: { orderNumber: 'ORD-2026-10002' },
    update: {},
    create: {
      orderNumber: 'ORD-2026-10002',
      userId: userA.id,
      distributorId: distA.id,
      status: 'PAID',
      subtotal: new Prisma.Decimal('154.98'),
      taxAmount: new Prisma.Decimal('12.40'),
      shippingAmount: new Prisma.Decimal('0.00'),
      discountAmount: new Prisma.Decimal('0.00'),
      totalAmount: new Prisma.Decimal('167.38'),
      totalBV: new Prisma.Decimal('115.00'),
      paidAt: new Date('2026-09-12T10:15:00Z'),
      items: {
        create: [
          {
            productId: createdProducts['ELE-WATCH-001'].id,
            quantity: 1,
            unitPrice: new Prisma.Decimal('99.99'),
            unitBV: new Prisma.Decimal('75.00'),
            totalPrice: new Prisma.Decimal('99.99'),
            totalBV: new Prisma.Decimal('75.00'),
          },
          {
            productId: createdProducts['ELE-EARBUD-001'].id,
            quantity: 1,
            unitPrice: new Prisma.Decimal('54.99'),
            unitBV: new Prisma.Decimal('40.00'),
            totalPrice: new Prisma.Decimal('54.99'),
            totalBV: new Prisma.Decimal('40.00'),
          },
        ],
      },
      payments: {
        create: [
          {
            paymentNumber: 'PAY-10002',
            method: 'WALLET',
            status: 'COMPLETED',
            amount: new Prisma.Decimal('167.38'),
            currency: 'USD',
            paidAt: new Date('2026-09-12T10:15:00Z'),
          },
        ],
      },
    },
  });

  // Order 3: Distributor B (Right Leg) Purchase
  const order3 = await prisma.order.upsert({
    where: { orderNumber: 'ORD-2026-10003' },
    update: {},
    create: {
      orderNumber: 'ORD-2026-10003',
      userId: userB.id,
      distributorId: distB.id,
      status: 'SHIPPED',
      subtotal: new Prisma.Decimal('136.97'),
      taxAmount: new Prisma.Decimal('10.96'),
      shippingAmount: new Prisma.Decimal('0.00'),
      discountAmount: new Prisma.Decimal('0.00'),
      totalAmount: new Prisma.Decimal('147.93'),
      totalBV: new Prisma.Decimal('95.00'),
      trackingNumber: 'TRK-FEDEX-481921',
      paidAt: new Date('2026-09-13T16:20:00Z'),
      items: {
        create: [
          {
            productId: createdProducts['CLO-HOODIE-001'].id,
            quantity: 2,
            unitPrice: new Prisma.Decimal('49.99'),
            unitBV: new Prisma.Decimal('35.00'),
            totalPrice: new Prisma.Decimal('99.98'),
            totalBV: new Prisma.Decimal('70.00'),
          },
          {
            productId: createdProducts['ELE-PWRBNK-001'].id,
            quantity: 1,
            unitPrice: new Prisma.Decimal('36.99'),
            unitBV: new Prisma.Decimal('25.00'),
            totalPrice: new Prisma.Decimal('36.99'),
            totalBV: new Prisma.Decimal('25.00'),
          },
        ],
      },
      payments: {
        create: [
          {
            paymentNumber: 'PAY-10003',
            method: 'UPI',
            status: 'COMPLETED',
            amount: new Prisma.Decimal('147.93'),
            currency: 'USD',
            paidAt: new Date('2026-09-13T16:20:00Z'),
          },
        ],
      },
    },
  });

  // Order 4: Distributor C (Left-Left) Purchase
  const order4 = await prisma.order.upsert({
    where: { orderNumber: 'ORD-2026-10004' },
    update: {},
    create: {
      orderNumber: 'ORD-2026-10004',
      userId: userC.id,
      distributorId: distC.id,
      status: 'PAID',
      subtotal: new Prisma.Decimal('118.97'),
      taxAmount: new Prisma.Decimal('9.52'),
      shippingAmount: new Prisma.Decimal('0.00'),
      discountAmount: new Prisma.Decimal('0.00'),
      totalAmount: new Prisma.Decimal('128.49'),
      totalBV: new Prisma.Decimal('80.00'),
      paidAt: new Date('2026-09-16T11:00:00Z'),
      items: {
        create: [
          {
            productId: createdProducts['ELE-SMTDEV-001'].id,
            quantity: 1,
            unitPrice: new Prisma.Decimal('74.99'),
            unitBV: new Prisma.Decimal('50.00'),
            totalPrice: new Prisma.Decimal('74.99'),
            totalBV: new Prisma.Decimal('50.00'),
          },
          {
            productId: createdProducts['CLO-INNER-001'].id,
            quantity: 2,
            unitPrice: new Prisma.Decimal('21.99'),
            unitBV: new Prisma.Decimal('15.00'),
            totalPrice: new Prisma.Decimal('43.98'),
            totalBV: new Prisma.Decimal('30.00'),
          },
        ],
      },
      payments: {
        create: [
          {
            paymentNumber: 'PAY-10004',
            method: 'DEBIT_CARD',
            status: 'COMPLETED',
            amount: new Prisma.Decimal('128.49'),
            currency: 'USD',
            paidAt: new Date('2026-09-16T11:00:00Z'),
          },
        ],
      },
    },
  });

  // ==========================================
  // 13. Sample BV Transactions (Immutable BVLedger)
  // ==========================================
  // 1. Order 2 BV credited to Demo Distributor BC1 Left Leg
  await prisma.bVLedger.upsert({
    where: { id: 'bv-demo-txn-001' },
    update: {},
    create: {
      id: 'bv-demo-txn-001',
      distributorId: rahulDistributor.id,
      businessCenterId: rahulBC1.id,
      sourceType: 'ORDER',
      sourceId: order2.orderNumber,
      orderId: order2.id,
      sourceDistributorId: distA.id,
      position: 'LEFT',
      bv: new Prisma.Decimal('115.00'),
      amount: new Prisma.Decimal('115.00'),
      balanceAfter: new Prisma.Decimal('14500.00'),
      commissionPeriodId: periodW37.id,
      type: 'ORDER_ACCRUAL',
      description: 'Group Volume from Distributor A (Left Leg)',
    },
  });

  // 2. Order 3 BV credited to Demo Distributor BC1 Right Leg
  await prisma.bVLedger.upsert({
    where: { id: 'bv-demo-txn-002' },
    update: {},
    create: {
      id: 'bv-demo-txn-002',
      distributorId: rahulDistributor.id,
      businessCenterId: rahulBC1.id,
      sourceType: 'ORDER',
      sourceId: order3.orderNumber,
      orderId: order3.id,
      sourceDistributorId: distB.id,
      position: 'RIGHT',
      bv: new Prisma.Decimal('95.00'),
      amount: new Prisma.Decimal('95.00'),
      balanceAfter: new Prisma.Decimal('11200.00'),
      commissionPeriodId: periodW37.id,
      type: 'ORDER_ACCRUAL',
      description: 'Group Volume from Distributor B (Right Leg)',
    },
  });

  // 3. Order 4 BV credited to Distributor A BC1 Left Leg
  await prisma.bVLedger.upsert({
    where: { id: 'bv-demo-txn-003' },
    update: {},
    create: {
      id: 'bv-demo-txn-003',
      distributorId: distA.id,
      businessCenterId: bcA.id,
      sourceType: 'ORDER',
      sourceId: order4.orderNumber,
      orderId: order4.id,
      sourceDistributorId: distC.id,
      position: 'LEFT',
      bv: new Prisma.Decimal('80.00'),
      amount: new Prisma.Decimal('80.00'),
      balanceAfter: new Prisma.Decimal('6200.00'),
      commissionPeriodId: periodW38.id,
      type: 'ORDER_ACCRUAL',
      description: 'Group Volume from Distributor C (Left Leg)',
    },
  });

  // 4. Order 1 Customer BV credited to Demo Distributor Personal Volume
  await prisma.bVLedger.upsert({
    where: { id: 'bv-demo-txn-004' },
    update: {},
    create: {
      id: 'bv-demo-txn-004',
      distributorId: rahulDistributor.id,
      sourceType: 'ORDER',
      sourceId: order1.orderNumber,
      orderId: order1.id,
      bv: new Prisma.Decimal('48.00'),
      amount: new Prisma.Decimal('48.00'),
      balanceAfter: new Prisma.Decimal('1548.00'),
      commissionPeriodId: periodW37.id,
      type: 'ORDER_ACCRUAL',
      description: 'Personal Customer Retail Volume from Preferred Customer',
    },
  });

  // ==========================================
  // 14. Sample Commission Records
  // ==========================================
  // 1. Binary Team Match for Demo Distributor in Period W37
  await prisma.commission.upsert({
    where: { commissionNumber: 'COM-10001' },
    update: {},
    create: {
      commissionNumber: 'COM-10001',
      businessReference: 'REF-COM-W37-KV1001-BIN',
      distributorId: rahulDistributor.id,
      businessCenterId: rahulBC1.id,
      periodId: periodW37.id,
      ruleId: binaryRule.id,
      type: 'BINARY',
      amount: new Prisma.Decimal('350.00'),
      status: 'PAID',
      leftVolumeMatched: new Prisma.Decimal('3500.00'),
      rightVolumeMatched: new Prisma.Decimal('3500.00'),
      payoutDate: new Date('2026-09-15T03:00:00Z'),
      details: {
        cycleCount: 1,
        matchPercent: 10,
        paidVolume: 3500,
        carryForwardLeft: 11000,
        carryForwardRight: 7700,
      },
    },
  });

  // 2. Direct Sponsor Bonus for Demo Distributor from Order 2
  await prisma.commission.upsert({
    where: { commissionNumber: 'COM-10002' },
    update: {},
    create: {
      commissionNumber: 'COM-10002',
      businessReference: 'REF-COM-W37-KV1001-DIR',
      distributorId: rahulDistributor.id,
      periodId: periodW37.id,
      ruleId: referralRule.id,
      type: 'FRONTLINE',
      amount: new Prisma.Decimal('120.00'),
      status: 'PAID',
      sourceOrderId: order2.id,
      sourceDistributorId: distA.id,
      payoutDate: new Date('2026-09-15T03:00:00Z'),
      details: { bonusPercentage: 20, qualifyingBV: 115 },
    },
  });

  // 3. Rank Advancement Bonus for Distributor A
  await prisma.commission.upsert({
    where: { commissionNumber: 'COM-10003' },
    update: {},
    create: {
      commissionNumber: 'COM-10003',
      businessReference: 'REF-COM-W37-KV1002-RNK',
      distributorId: distA.id,
      periodId: periodW37.id,
      ruleId: rankBonusRule.id,
      type: 'RANK',
      amount: new Prisma.Decimal('150.00'),
      status: 'PAID',
      payoutDate: new Date('2026-09-15T03:00:00Z'),
      details: { achievedRank: 'Silver', oneTimeBonus: 150 },
    },
  });

  // ==========================================
  // 15. Sample Wallet Transactions
  // ==========================================
  const rahulWallet = await prisma.wallet.findUnique({ where: { distributorId: rahulDistributor.id } });
  if (rahulWallet) {
    // Credit 1: Binary Commission Payout
    await prisma.walletTransaction.upsert({
      where: { transactionNumber: 'WTX-10001' },
      update: {},
      create: {
        walletId: rahulWallet.id,
        transactionNumber: 'WTX-10001',
        type: 'COMMISSION_CREDIT',
        status: 'COMPLETED',
        amount: new Prisma.Decimal('350.00'),
        feeAmount: new Prisma.Decimal('0.00'),
        netAmount: new Prisma.Decimal('350.00'),
        balanceBefore: new Prisma.Decimal('500.00'),
        balanceAfter: new Prisma.Decimal('850.00'),
        referenceId: 'COM-10001',
        description: 'Weekly Binary Team Match Commission - Period W-2026-37',
        createdAt: new Date('2026-09-15T03:05:00Z'),
      },
    });

    // Credit 2: Direct Sponsor Bonus
    await prisma.walletTransaction.upsert({
      where: { transactionNumber: 'WTX-10002' },
      update: {},
      create: {
        walletId: rahulWallet.id,
        transactionNumber: 'WTX-10002',
        type: 'BONUS_CREDIT',
        status: 'COMPLETED',
        amount: new Prisma.Decimal('120.00'),
        feeAmount: new Prisma.Decimal('0.00'),
        netAmount: new Prisma.Decimal('120.00'),
        balanceBefore: new Prisma.Decimal('850.00'),
        balanceAfter: new Prisma.Decimal('970.00'),
        referenceId: 'COM-10002',
        description: 'Direct Sponsor Bonus from Distributor A Enrollment',
        createdAt: new Date('2026-09-15T03:10:00Z'),
      },
    });

    // Debit 3: Payout Withdrawal to Bank Account
    const payoutTxn = await prisma.walletTransaction.upsert({
      where: { transactionNumber: 'WTX-10003' },
      update: {},
      create: {
        walletId: rahulWallet.id,
        transactionNumber: 'WTX-10003',
        type: 'PAYOUT_WITHDRAWAL',
        status: 'COMPLETED',
        amount: new Prisma.Decimal('250.00'),
        feeAmount: new Prisma.Decimal('5.00'),
        netAmount: new Prisma.Decimal('245.00'),
        balanceBefore: new Prisma.Decimal('970.00'),
        balanceAfter: new Prisma.Decimal('720.00'),
        referenceId: 'POR-10001',
        description: 'Bank Wire Withdrawal to JPMorgan Chase (Account ending 1098)',
        createdAt: new Date('2026-09-16T09:00:00Z'),
      },
    });

    // Payout Request record
    await prisma.payoutRequest.upsert({
      where: { payoutNumber: 'POR-10001' },
      update: {},
      create: {
        payoutNumber: 'POR-10001',
        distributorId: rahulDistributor.id,
        bankAccountId: rahulBankAccount.id,
        walletTransactionId: payoutTxn.id,
        amount: new Prisma.Decimal('250.00'),
        fee: new Prisma.Decimal('5.00'),
        netAmount: new Prisma.Decimal('245.00'),
        status: 'PAID',
        referenceNumber: 'ACH-TRACE-98124021',
        processedAt: new Date('2026-09-16T12:00:00Z'),
      },
    });
  }

  // ==========================================
  // 16. Training Course, Lessons & Progress
  // ==========================================
  const quickStartCourse = await prisma.trainingCourse.upsert({
    where: { slug: 'distributor-quick-start' },
    update: {},
    create: {
      slug: 'distributor-quick-start',
      title: 'Distributor Quick Start Blueprint',
      description: 'Master the fundamentals of your virtual office, binary structure, and compensation plan.',
      category: 'ORIENTATION',
      isMandatory: true,
      displayOrder: 1,
      lessons: {
        create: [
          {
            title: 'Lesson 1: Understanding Sponsor vs Binary Placement',
            content: 'Learn why your direct sponsor tree and your binary tree placement parent operate independently, and how dual business centers drive volume matching.',
            durationMinutes: 15,
            displayOrder: 1,
          },
          {
            title: 'Lesson 2: Qualifying for Weekly Binary Commissions',
            content: 'How to maintain active personal volume (PV) and balance left and right leg group volume (GV) to maximize weekly commission cycles.',
            durationMinutes: 20,
            displayOrder: 2,
          },
          {
            title: 'Lesson 3: Navigating Multi-Business Center Strategy',
            content: 'Strategic placement techniques when activating BC2 and BC3 to create double-dipping volume leverage.',
            durationMinutes: 25,
            displayOrder: 3,
          },
        ],
      },
    },
  });

  const lessons = await prisma.trainingLesson.findMany({
    where: { courseId: quickStartCourse.id },
    orderBy: { displayOrder: 'asc' },
  });

  if (lessons.length >= 2) {
    // Rahul: Completed all available lessons
    for (const les of lessons) {
      await prisma.trainingProgress.upsert({
        where: {
          distributorId_lessonId: {
            distributorId: rahulDistributor.id,
            lessonId: les.id,
          },
        },
        update: { isCompleted: true },
        create: {
          distributorId: rahulDistributor.id,
          lessonId: les.id,
          isCompleted: true,
          startedAt: new Date('2026-01-05T10:00:00Z'),
          completedAt: new Date('2026-01-05T11:00:00Z'),
        },
      });
    }

    // Distributor A: Completed Lesson 1, In-progress on Lesson 2
    await prisma.trainingProgress.upsert({
      where: {
        distributorId_lessonId: {
          distributorId: distA.id,
          lessonId: lessons[0].id,
        },
      },
      update: { isCompleted: true },
      create: {
        distributorId: distA.id,
        lessonId: lessons[0].id,
        isCompleted: true,
        startedAt: new Date('2026-01-11T14:00:00Z'),
        completedAt: new Date('2026-01-11T14:25:00Z'),
      },
    });

    if (lessons[1]) {
      await prisma.trainingProgress.upsert({
        where: {
          distributorId_lessonId: {
            distributorId: distA.id,
            lessonId: lessons[1].id,
          },
        },
        update: { isCompleted: false },
        create: {
          distributorId: distA.id,
          lessonId: lessons[1].id,
          isCompleted: false,
          startedAt: new Date('2026-01-12T09:00:00Z'),
        },
      });
    }
  }

  // ==========================================
  // 17. Support Ticket & Message Thread
  // ==========================================
  const ticket = await prisma.supportTicket.upsert({
    where: { ticketNumber: 'TCK-10001' },
    update: {},
    create: {
      ticketNumber: 'TCK-10001',
      userId: rahulUser.id,
      distributorId: rahulDistributor.id,
      name: 'Rahul Example',
      email: 'rahul.example@example.com',
      department: 'COMMISSIONS',
      priority: 'MEDIUM',
      status: 'OPEN',
      subject: 'Inquiry regarding Binary Matching Cycle Payout',
      description: 'Hello Support Team, I am checking to verify when the pending cycle bonus for Period W-2026-38 will reflect in my e-wallet. Thanks!',
      messages: {
        create: [
          {
            senderId: rahulUser.id,
            message: 'Hello Support Team, I am checking to verify when the pending cycle bonus for Period W-2026-38 will reflect in my e-wallet. Thanks!',
          },
          {
            senderId: adminUser.id,
            message: 'Hi Rahul, Period W-2026-38 closes on Sunday at 23:59:59 UTC. Calculations will run on Monday morning and qualify for immediate wallet payout upon admin approval.',
          },
        ],
      },
    },
  });

  // ==========================================
  // 18. Published News Articles
  // ==========================================
  await prisma.news.upsert({
    where: { slug: 'welcome-to-kashvimlm-platform' },
    update: {},
    create: {
      slug: 'welcome-to-kashvimlm-platform',
      title: 'Welcome to the Next-Generation Kashvimlm Platform',
      summary: 'State-of-the-art distributor management, instant genealogy tracking, and automated commissions.',
      content: 'We are thrilled to unveil the new Kashvimlm enterprise distributor management infrastructure featuring real-time binary placement, multiple business center support, and transparent e-wallet payouts.',
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date('2026-09-01T00:00:00Z'),
      targetAudience: 'ALL',
      authorId: adminUser.id,
    },
  });

  await prisma.news.upsert({
    where: { slug: 'new-apparel-smart-devices-line' },
    update: {},
    create: {
      slug: 'new-apparel-smart-devices-line',
      title: 'New Clothes & Hosiery and Smart Devices Collection Live',
      summary: 'Discover high-demand combed cotton apparel, graduated compression hosiery, and biometric smart devices.',
      content: 'Our latest catalog expansion is now active! Distributors earn top Business Volume (BV) across our new apparel line including Cotton Hosiery T-Shirts, Bamboo Socks, and high-tech biometric wearables.',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date('2026-09-10T00:00:00Z'),
      targetAudience: 'ALL',
      authorId: adminUser.id,
    },
  });

  await prisma.news.upsert({
    where: { slug: 'weekly-payout-cycle-enhancements' },
    update: {},
    create: {
      slug: 'weekly-payout-cycle-enhancements',
      title: 'Upgraded Weekly E-Wallet Payout Cycle & Instant Genealogies',
      summary: 'Automated weekly commission cycles now process directly into distributor e-wallets with instant ACH/UPI settlement.',
      content: 'We have updated our financial ledger with guaranteed idempotency and real-time volume synchronization, giving every distributor transparent audit visibility.',
      image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date('2026-09-15T00:00:00Z'),
      targetAudience: 'ALL',
      authorId: adminUser.id,
    },
  });

  // ==========================================
  // 19. Sample Notifications
  // ==========================================
  await prisma.notification.upsert({
    where: { id: 'notif-demo-001' },
    update: {},
    create: {
      id: 'notif-demo-001',
      userId: rahulUser.id,
      title: 'Welcome to Kashvi MLM!',
      message: 'Your distributor account KV-DEMO-1001 is active. Access your 3 Business Centers from the virtual office.',
      type: 'WELCOME',
      isRead: true,
      readAt: new Date('2026-01-02T10:00:00Z'),
    },
  });

  await prisma.notification.upsert({
    where: { id: 'notif-demo-002' },
    update: {},
    create: {
      id: 'notif-demo-002',
      userId: rahulUser.id,
      title: 'Commission Payout Received',
      message: 'You have been credited $350.00 Binary Commission for Period W-2026-37 in your e-wallet.',
      type: 'COMMISSION',
      linkUrl: '/wallet',
      isRead: false,
    },
  });

  await prisma.notification.upsert({
    where: { id: 'notif-demo-003' },
    update: {},
    create: {
      id: 'notif-demo-003',
      userId: rahulUser.id,
      title: 'New Team Member Placement',
      message: 'Distributor Charlie Davis (KV-DEMO-1004) has joined your left leg binary team under Distributor A.',
      type: 'TEAM',
      linkUrl: '/team/tree',
      isRead: false,
    },
  });

  await prisma.notification.upsert({
    where: { id: 'notif-cust-001' },
    update: {},
    create: {
      id: 'notif-cust-001',
      userId: customerUser.id,
      title: 'Order Confirmed',
      message: 'Your order #ORD-2026-10001 has been confirmed and delivered. Thank you for shopping with Kashvi!',
      type: 'ORDER',
      linkUrl: '/orders/ORD-2026-10001',
      isRead: true,
      readAt: new Date('2026-09-11T12:00:00Z'),
    },
  });

  // ==========================================
  // 20. System Settings
  // ==========================================
  const settings = [
    { key: 'BINARY_MATCH_PERCENTAGE', value: '10.00', dataType: 'DECIMAL', category: 'COMPENSATION' },
    { key: 'DEFAULT_SPONSOR_CODE', value: 'KV-DEMO-1001', dataType: 'STRING', category: 'SYSTEM' },
    { key: 'MIN_PAYOUT_AMOUNT', value: '50.00', dataType: 'DECIMAL', category: 'FINANCE' },
    { key: 'MAX_BUSINESS_CENTERS', value: '3', dataType: 'INTEGER', category: 'COMPENSATION' },
    { key: 'AUTO_FLUSH_PERIOD_DAYS', value: '365', dataType: 'INTEGER', category: 'COMPENSATION' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  // ==========================================
  // 21. Configurable 5-Level Commission Rates (Prompt 13)
  // ==========================================
  const commissionLevels = [
    { levelNumber: 1, percentage: new Prisma.Decimal('24.00'), isActive: true },
    { levelNumber: 2, percentage: new Prisma.Decimal('8.00'), isActive: true },
    { levelNumber: 3, percentage: new Prisma.Decimal('13.00'), isActive: true },
    { levelNumber: 4, percentage: new Prisma.Decimal('5.00'), isActive: true },
    { levelNumber: 5, percentage: new Prisma.Decimal('4.00'), isActive: true },
  ];

  for (const lvl of commissionLevels) {
    await prisma.commissionLevel.upsert({
      where: { levelNumber: lvl.levelNumber },
      update: { percentage: lvl.percentage, isActive: lvl.isActive },
      create: lvl,
    });
  }

  console.log('✅ Realistic Development Seeding Complete!');
  console.log('   - Admin: admin@example.com (Password: AdminPassword@2026)');
  console.log('   - Primary Distributor: Rahul Example (KV-DEMO-1001, Email: rahul.example@example.com)');
  console.log('   - Business Centers: KV-DEMO-1001-BC1, BC2, BC3');
  console.log('   - Preferred Customer: customer@example.com (CUST-20001)');
  console.log('   - Binary Tree: Demo -> (A: Left, B: Right) -> (C, D under A / E, F under B)');
  console.log(`   - Categories: 2 | Products: 8`);
  console.log('   - Orders: 4 | BV Ledgers: 4 | Commissions: 3 | Wallet Txns: 3');
  console.log('   - Support Ticket: TCK-10001 | News: 3 | Notifications: 4');
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  seedDatabase()
    .catch((error) => {
      console.error('❌ Error during database seeding:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
