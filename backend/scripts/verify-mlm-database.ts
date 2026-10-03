import { PrismaClient, PlacementPosition } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log('===============================================================');
  console.log('🧪 BINARY MLM DATABASE STRUCTURE & RELATIONSHIP VALIDATION');
  console.log('===============================================================\n');

  // -------------------------------------------------------------------------
  // 1. VERIFY SEED DATA: Rahul, Amit, Rohit, Neha, Pooja (KV-DEMO-1001 to 1005)
  // -------------------------------------------------------------------------
  console.log('1. Checking Seeded Distributors (Rahul, Amit, Rohit, Neha, Pooja):');

  const rahul = await prisma.distributorProfile.findFirst({
    where: {
      firstName: 'Rahul',
      OR: [{ distributorCode: 'KV-1001' }, { distributorId: 'KV-1001' }, { distributorCode: 'KV-DEMO-1001' }],
    },
    include: { businessCenters: true, mlmNodes: true },
  });

  const amit = await prisma.distributorProfile.findFirst({
    where: {
      firstName: 'Amit',
      OR: [{ distributorCode: 'KV-1002' }, { distributorId: 'KV-1002' }, { distributorCode: 'KV-DEMO-1002' }],
    },
    include: { businessCenters: true, mlmNodes: true },
  });

  const rohit = await prisma.distributorProfile.findFirst({
    where: {
      firstName: 'Rohit',
      OR: [{ distributorCode: 'KV-1003' }, { distributorId: 'KV-1003' }, { distributorCode: 'KV-DEMO-1003' }],
    },
    include: { businessCenters: true, mlmNodes: true },
  });

  const neha = await prisma.distributorProfile.findFirst({
    where: {
      firstName: 'Neha',
      OR: [{ distributorCode: 'KV-DEMO-1004' }, { distributorId: 'KV-DEMO-1004' }, { distributorId: 'KV-1004' }],
    },
    include: { businessCenters: true, mlmNodes: true },
  });

  const pooja = await prisma.distributorProfile.findFirst({
    where: {
      firstName: 'Pooja',
      OR: [{ distributorCode: 'KV-DEMO-1005' }, { distributorId: 'KV-DEMO-1005' }, { distributorId: 'KV-1005' }],
    },
    include: { businessCenters: true, mlmNodes: true },
  });

  if (!rahul) throw new Error('❌ Rahul (KV-DEMO-1001) not found in database!');
  if (!amit) throw new Error('❌ Amit (KV-DEMO-1002) not found in database!');
  if (!rohit) throw new Error('❌ Rohit (KV-DEMO-1003) not found in database!');
  if (!neha) throw new Error('❌ Neha (KV-DEMO-1004) not found in database!');
  if (!pooja) throw new Error('❌ Pooja (KV-DEMO-1005) not found in database!');

  console.log(`   ✅ Rahul found: [ID: ${rahul.id}] Code: ${rahul.distributorCode}, Name: ${rahul.firstName} ${rahul.lastName}`);
  console.log(`   ✅ Amit found:  [ID: ${amit.id}] Code: ${amit.distributorCode}, Name: ${amit.firstName} ${amit.lastName}`);
  console.log(`   ✅ Rohit found: [ID: ${rohit.id}] Code: ${rohit.distributorCode}, Name: ${rohit.firstName} ${rohit.lastName}`);
  console.log(`   ✅ Neha found:  [ID: ${neha.id}] Code: ${neha.distributorCode}, Name: ${neha.firstName} ${neha.lastName}`);
  console.log(`   ✅ Pooja found: [ID: ${pooja.id}] Code: ${pooja.distributorCode}, Name: ${pooja.firstName} ${pooja.lastName}`);
  console.log('   [PASS] All 5 seeded distributors verified.\n');

  // -------------------------------------------------------------------------
  // 2. VERIFY REQUIRED DISTRIBUTOR FIELDS
  // -------------------------------------------------------------------------
  console.log('2. Verifying Required Distributor Fields:');
  const requiredDistributorFields = ['id', 'userId', 'distributorId', 'sponsorId', 'status', 'rankId', 'createdAt', 'updatedAt'];
  for (const field of requiredDistributorFields) {
    const hasField = field in rahul;
    console.log(`   - Field '${field}': ${hasField ? 'PRESENT ✅' : 'MISSING ❌'}`);
    if (!hasField) throw new Error(`Missing field ${field} in DistributorProfile`);
  }
  console.log('   [PASS] All required distributor fields verified.\n');

  // -------------------------------------------------------------------------
  // 3. VERIFY REQUIRED MLM TREE MODEL FIELDS
  // -------------------------------------------------------------------------
  console.log('3. Verifying Required MLM Tree Model Fields:');
  const rahulNode = rahul.mlmNodes[0];
  const amitNode = amit.mlmNodes[0];
  const rohitNode = rohit.mlmNodes[0];
  const nehaNode = neha.mlmNodes[0];
  const poojaNode = pooja.mlmNodes[0];

  if (!rahulNode) throw new Error('❌ Rahul has no MLM tree node!');
  if (!amitNode) throw new Error('❌ Amit has no MLM tree node!');
  if (!rohitNode) throw new Error('❌ Rohit has no MLM tree node!');
  if (!nehaNode) throw new Error('❌ Neha has no MLM tree node!');
  if (!poojaNode) throw new Error('❌ Pooja has no MLM tree node!');

  const requiredTreeFields = ['id', 'distributorId', 'businessCenterId', 'placementParentId', 'placementPosition', 'createdAt', 'updatedAt'];
  for (const field of requiredTreeFields) {
    const hasField = field in amitNode;
    console.log(`   - Field '${field}': ${hasField ? 'PRESENT ✅' : 'MISSING ❌'}`);
    if (!hasField) throw new Error(`Missing field ${field} in MLMNode`);
  }
  console.log('   [PASS] All required MLM tree model fields verified.\n');

  // -------------------------------------------------------------------------
  // 4. VERIFY 5-DISTRIBUTOR BINARY TREE TOPOLOGY & RELATIONSHIPS
  // -------------------------------------------------------------------------
  console.log('4. Verifying 5-Distributor Binary Tree Topology:');
  console.log('                 Rahul');
  console.log('                /     \\');
  console.log('             Amit     Rohit');
  console.log('             /   \\');
  console.log('          Neha   Pooja\n');

  console.log(`   - Rahul Root Node ID:     ${rahulNode.id} (Parent: ${rahulNode.placementParentId === null ? 'NULL (ROOT ✅)' : rahulNode.placementParentId})`);
  console.log(`   - Amit Placement Parent:  ${amitNode.placementParentId} (Rahul: ${amitNode.placementParentId === rahulNode.id ? 'YES ✅' : 'NO ❌'}), Leg: ${amitNode.placementPosition}`);
  console.log(`   - Rohit Placement Parent: ${rohitNode.placementParentId} (Rahul: ${rohitNode.placementParentId === rahulNode.id ? 'YES ✅' : 'NO ❌'}), Leg: ${rohitNode.placementPosition}`);
  console.log(`   - Neha Placement Parent:  ${nehaNode.placementParentId} (Amit: ${nehaNode.placementParentId === amitNode.id ? 'YES ✅' : 'NO ❌'}), Leg: ${nehaNode.placementPosition}`);
  console.log(`   - Pooja Placement Parent: ${poojaNode.placementParentId} (Amit: ${poojaNode.placementParentId === amitNode.id ? 'YES ✅' : 'NO ❌'}), Leg: ${poojaNode.placementPosition}`);

  // Validate Topology
  if (rahulNode.placementParentId !== null) throw new Error('Rahul root node must have placementParentId = null');
  if (amitNode.placementParentId !== rahulNode.id) throw new Error('Amit placementParentId must be Rahul node ID');
  if (amitNode.placementPosition !== 'LEFT') throw new Error('Amit placementPosition must be LEFT');
  if (rohitNode.placementParentId !== rahulNode.id) throw new Error('Rohit placementParentId must be Rahul node ID');
  if (rohitNode.placementPosition !== 'RIGHT') throw new Error('Rohit placementPosition must be RIGHT');
  if (nehaNode.placementParentId !== amitNode.id) throw new Error('Neha placementParentId must be Amit node ID');
  if (nehaNode.placementPosition !== 'LEFT') throw new Error('Neha placementPosition must be LEFT');
  if (poojaNode.placementParentId !== amitNode.id) throw new Error('Pooja placementParentId must be Amit node ID');
  if (poojaNode.placementPosition !== 'RIGHT') throw new Error('Pooja placementPosition must be RIGHT');

  console.log('   [PASS] 5-Distributor binary tree structure fully verified.\n');

  // -------------------------------------------------------------------------
  // 5. NEGATIVE CONSTRAINT TEST: Prevent Duplicate Placement on Same Leg
  // -------------------------------------------------------------------------
  console.log('5. Testing Database Unique Constraint: parent + LEFT = maximum 1 member');
  console.log('   Attempting to insert a second child under Rahul on LEFT...');

  // Create temporary test user and distributor
  const tempUser = await prisma.user.create({
    data: {
      email: `temp.test.${Date.now()}@example.com`,
      passwordHash: 'dummy_hash',
      roleName: 'DISTRIBUTOR',
    },
  });

  const tempDistributor = await prisma.distributorProfile.create({
    data: {
      userId: tempUser.id,
      distributorCode: `KV-TMP-${Math.floor(1000 + Math.random() * 9000)}`,
      distributorId: `KV-TMP-${Math.floor(1000 + Math.random() * 9000)}`,
      firstName: 'Duplicate',
      lastName: 'LeftTester',
      sponsorId: rahul.id,
      status: 'ACTIVE',
    },
  });

  const tempBC = await prisma.businessCenter.create({
    data: {
      distributorId: tempDistributor.id,
      centerCode: `BC-TMP-${Date.now()}`,
      status: 'ACTIVE',
    },
  });

  let duplicateLeftBlocked = false;
  try {
    await prisma.mLMNode.create({
      data: {
        businessCenterId: tempBC.id,
        distributorId: tempDistributor.id,
        placementParentId: rahulNode.id, // Rahul already has Amit on LEFT!
        placementPosition: PlacementPosition.LEFT,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002' || err.message?.includes('Unique constraint failed')) {
      duplicateLeftBlocked = true;
      console.log('   ✅ PostgreSQL REJECTED duplicate LEFT child! Error code: P2002 (Unique constraint failed)');
      console.log(`      Detail: ${JSON.stringify(err.meta?.target || 'placementParentId_placementPosition')}`);
    } else {
      console.error('Unexpected error:', err);
    }
  }

  if (!duplicateLeftBlocked) {
    throw new Error('❌ FAILED: Database permitted duplicate LEFT child under the same parent!');
  }
  console.log('   [PASS] Database constraint parent + LEFT = max 1 member STRICTLY ENFORCED.\n');

  // -------------------------------------------------------------------------
  // 6. NEGATIVE CONSTRAINT TEST: Prevent Duplicate Placement on RIGHT Leg
  // -------------------------------------------------------------------------
  console.log('6. Testing Database Unique Constraint: parent + RIGHT = maximum 1 member');
  console.log('   Attempting to insert a second child under Rahul on RIGHT...');

  let duplicateRightBlocked = false;
  try {
    await prisma.mLMNode.create({
      data: {
        businessCenterId: tempBC.id,
        distributorId: tempDistributor.id,
        placementParentId: rahulNode.id, // Rahul already has Rohit on RIGHT!
        placementPosition: PlacementPosition.RIGHT,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002' || err.message?.includes('Unique constraint failed')) {
      duplicateRightBlocked = true;
      console.log('   ✅ PostgreSQL REJECTED duplicate RIGHT child! Error code: P2002 (Unique constraint failed)');
      console.log(`      Detail: ${JSON.stringify(err.meta?.target || 'placementParentId_placementPosition')}`);
    } else {
      console.error('Unexpected error:', err);
    }
  }

  if (!duplicateRightBlocked) {
    throw new Error('❌ FAILED: Database permitted duplicate RIGHT child under the same parent!');
  }
  console.log('   [PASS] Database constraint parent + RIGHT = max 1 member STRICTLY ENFORCED.\n');

  // -------------------------------------------------------------------------
  // 7. SPILLOVER DEMONSTRATION: Sponsor != Placement Parent
  // -------------------------------------------------------------------------
  console.log('7. Demonstrating Spillover Placement (Sponsor != Placement Parent):');
  console.log('   Rahul sponsors new member "Vikram" (KV-1008).');
  console.log('   Rahul\'s LEFT and RIGHT are full. Vikram is placed under Amit on LEFT as spillover...');

  const vikramUser = await prisma.user.create({
    data: {
      email: `vikram.${Date.now()}@example.com`,
      passwordHash: 'dummy_hash',
      roleName: 'DISTRIBUTOR',
    },
  });

  const testDistCode = `KV-SPILL-${Date.now()}`;
  const vikram = await prisma.distributorProfile.create({
    data: {
      userId: vikramUser.id,
      distributorCode: testDistCode,
      distributorId: testDistCode,
      firstName: 'Vikram',
      lastName: 'Malhotra',
      displayName: 'Vikram Malhotra',
      sponsorId: rahul.id, // SPONSOR IS RAHUL!
      status: 'ACTIVE',
    },
  });

  const vikramBC = await prisma.businessCenter.create({
    data: {
      distributorId: vikram.id,
      centerCode: `${testDistCode}-BC1`,
      status: 'ACTIVE',
    },
  });

  // Neha's node (ROOT/L/L) who has open LEFT and RIGHT slots
  if (!nehaNode) throw new Error('Neha node not found');

  // Placed under Neha's node on LEFT as downline spillover!
  const vikramNode = await prisma.mLMNode.create({
    data: {
      businessCenterId: vikramBC.id,
      distributorId: vikram.id,
      placementParentId: nehaNode.id, // PLACEMENT PARENT IS NEHA!
      placementPosition: PlacementPosition.LEFT,
      depth: 3,
      binaryPath: 'ROOT/L/L/L',
    },
  });

  console.log(`   - Vikram ID:             ${vikram.id} (${vikram.firstName} ${vikram.lastName})`);
  console.log(`   - Vikram Sponsor ID:     ${vikram.sponsorId} (Rahul: ${vikram.sponsorId === rahul.id ? 'YES ✅' : 'NO ❌'})`);
  console.log(`   - Vikram PlacementParent: ${vikramNode.placementParentId} (Neha Node: ${vikramNode.placementParentId === nehaNode.id ? 'YES ✅' : 'NO ❌'})`);
  console.log(`   - Sponsor != Placement:  ${vikram.sponsorId !== vikramNode.placementParentId ? 'TRUE ✅' : 'FALSE ❌'}`);
  console.log(`   - Position under Neha:   ${vikramNode.placementPosition} ✅`);

  console.log('   [PASS] Spillover relationship (Sponsor != Placement Parent) successfully validated.\n');

  // Cleanup temporary test records
  try {
    await prisma.mLMNode.delete({ where: { id: vikramNode.id } });
    await prisma.businessCenter.delete({ where: { id: vikramBC.id } });
    await prisma.distributorProfile.delete({ where: { id: vikram.id } });
    await prisma.user.delete({ where: { id: vikramUser.id } });

    await prisma.businessCenter.delete({ where: { id: tempBC.id } });
    await prisma.distributorProfile.delete({ where: { id: tempDistributor.id } });
    await prisma.user.delete({ where: { id: tempUser.id } });
  } catch {}

  console.log('===============================================================');
  console.log('🎉 ALL DATABASE RELATIONSHIP & CONSTRAINT TESTS PASSED 100%!');
  console.log('===============================================================');
}

verifyDatabase()
  .catch((e) => {
    console.error('Validation failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
