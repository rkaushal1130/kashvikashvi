import { prisma } from '../src/config/database';
import { TreePlacementService } from '../src/services/treePlacement.service';
import { PlacementPosition } from '@prisma/client';

async function runPlacementVerification() {
  console.log('===============================================================');
  console.log('🧪 BINARY TREE PLACEMENT SERVICE & CONCURRENCY VERIFICATION');
  console.log('===============================================================\n');

  const ts = Date.now();

  // 1. Setup Root Parent Distributor & Node
  console.log('Setup: Creating test root distributor and parent node...');
  const rootUser = await prisma.user.create({
    data: { email: `root.user.${ts}@example.com`, passwordHash: 'hash', roleName: 'DISTRIBUTOR' },
  });
  const rootDist = await prisma.distributorProfile.create({
    data: {
      userId: rootUser.id,
      distributorCode: `KV-ROOT-${ts}`,
      distributorId: `KV-ROOT-${ts}`,
      firstName: 'Master',
      lastName: 'Root',
      status: 'ACTIVE',
    },
  });
  const rootBC = await prisma.businessCenter.create({
    data: { distributorId: rootDist.id, centerCode: `BC-ROOT-${ts}`, status: 'ACTIVE' },
  });
  const rootNode = await prisma.mLMNode.create({
    data: {
      distributorId: rootDist.id,
      businessCenterId: rootBC.id,
      depth: 0,
      binaryPath: 'ROOT',
    },
  });
  console.log(`   ✅ Root node created: ${rootNode.id} for distributor ${rootDist.distributorCode}\n`);

  // Helper to create a test distributor
  async function createTestDist(prefix: string, sponsorId = rootDist.id, status = 'ACTIVE') {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const u = await prisma.user.create({
      data: { email: `${prefix.toLowerCase()}.${id}@example.com`, passwordHash: 'hash', roleName: 'DISTRIBUTOR' },
    });
    const d = await prisma.distributorProfile.create({
      data: {
        userId: u.id,
        distributorCode: `KV-${prefix.toUpperCase()}-${id}`,
        distributorId: `KV-${prefix.toUpperCase()}-${id}`,
        firstName: prefix,
        lastName: 'TestUser',
        sponsorId,
        status: status as any,
      },
    });
    const bc = await prisma.businessCenter.create({
      data: { distributorId: d.id, centerCode: `BC-${prefix.toUpperCase()}-${id}`, status: 'ACTIVE' },
    });
    return { user: u, dist: d, bc };
  }

  // --------------------------------------------------------------------------
  // TEST 1: LEFT Placement
  // --------------------------------------------------------------------------
  console.log('1. Testing LEFT Placement:');
  const childL = await createTestDist('LeftChild');
  const res1 = await TreePlacementService.placeDistributor(childL.dist.id, rootNode.id, 'LEFT');

  console.log(`   - Success: ${res1.success}`);
  console.log(`   - Placed Position: ${res1.data?.placementPosition}`);
  console.log(`   - Node Path: ${res1.data?.binaryPath}`);

  if (!res1.success || res1.data.placementPosition !== 'LEFT') {
    throw new Error('❌ Test 1 failed: LEFT placement failed');
  }
  console.log('   [PASS] LEFT placement successful.\n');

  // --------------------------------------------------------------------------
  // TEST 2: RIGHT Placement
  // --------------------------------------------------------------------------
  console.log('2. Testing RIGHT Placement:');
  const childR = await createTestDist('RightChild');
  const res2 = await TreePlacementService.placeDistributor(childR.dist.id, rootNode.id, 'RIGHT');

  console.log(`   - Success: ${res2.success}`);
  console.log(`   - Placed Position: ${res2.data?.placementPosition}`);
  console.log(`   - Node Path: ${res2.data?.binaryPath}`);

  if (!res2.success || res2.data.placementPosition !== 'RIGHT') {
    throw new Error('❌ Test 2 failed: RIGHT placement failed');
  }
  console.log('   [PASS] RIGHT placement successful.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Occupied LEFT
  // --------------------------------------------------------------------------
  console.log('3. Testing Occupied LEFT Position:');
  const candidate3 = await createTestDist('CandidateL');
  const res3 = await TreePlacementService.placeDistributor(candidate3.dist.id, rootNode.id, 'LEFT');

  console.log(`   - Result Success: ${res3.success}`);
  console.log(`   - Error Code: ${res3.code}`);
  console.log(`   - Message: ${res3.message}`);

  if (res3.success !== false || res3.code !== 'POSITION_ALREADY_OCCUPIED') {
    throw new Error('❌ Test 3 failed: Expected POSITION_ALREADY_OCCUPIED');
  }
  console.log('   [PASS] Occupied LEFT rejected with POSITION_ALREADY_OCCUPIED.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Occupied RIGHT
  // --------------------------------------------------------------------------
  console.log('4. Testing Occupied RIGHT Position:');
  const candidate4 = await createTestDist('CandidateR');
  const res4 = await TreePlacementService.placeDistributor(candidate4.dist.id, rootNode.id, 'RIGHT');

  console.log(`   - Result Success: ${res4.success}`);
  console.log(`   - Error Code: ${res4.code}`);
  console.log(`   - Message: ${res4.message}`);

  if (res4.success !== false || res4.code !== 'POSITION_ALREADY_OCCUPIED') {
    throw new Error('❌ Test 4 failed: Expected POSITION_ALREADY_OCCUPIED');
  }
  console.log('   [PASS] Occupied RIGHT rejected with POSITION_ALREADY_OCCUPIED.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Self-Placement
  // --------------------------------------------------------------------------
  console.log('5. Testing Self-Placement:');
  const res5 = await TreePlacementService.placeDistributor(rootDist.id, rootNode.id, 'LEFT');

  console.log(`   - Result Success: ${res5.success}`);
  console.log(`   - Error Code: ${res5.code}`);

  if (res5.success !== false || res5.code !== 'SELF_PLACEMENT_FORBIDDEN') {
    throw new Error('❌ Test 5 failed: Expected SELF_PLACEMENT_FORBIDDEN');
  }
  console.log('   [PASS] Self-placement rejected with SELF_PLACEMENT_FORBIDDEN.\n');

  // --------------------------------------------------------------------------
  // TEST 6: Circular Placement
  // --------------------------------------------------------------------------
  console.log('6. Testing Circular Placement:');
  // Attempt to place rootDist under res1.data (childL's node)
  const res6 = await TreePlacementService.placeDistributor(rootDist.id, res1.data.id, 'LEFT');

  console.log(`   - Result Success: ${res6.success}`);
  console.log(`   - Error Code: ${res6.code}`);

  if (res6.success !== false || res6.code !== 'CIRCULAR_PLACEMENT_FORBIDDEN') {
    throw new Error('❌ Test 6 failed: Expected CIRCULAR_PLACEMENT_FORBIDDEN');
  }
  console.log('   [PASS] Circular placement rejected with CIRCULAR_PLACEMENT_FORBIDDEN.\n');

  // --------------------------------------------------------------------------
  // TEST 7: Invalid Parent
  // --------------------------------------------------------------------------
  console.log('7. Testing Invalid Parent:');
  const nonExistentId = '00000000-0000-0000-0000-000000000000';
  const res7 = await TreePlacementService.placeDistributor(candidate3.dist.id, nonExistentId, 'LEFT');

  console.log(`   - Result Success: ${res7.success}`);
  console.log(`   - Error Code: ${res7.code}`);

  if (res7.success !== false || res7.code !== 'PARENT_NOT_FOUND') {
    throw new Error('❌ Test 7 failed: Expected PARENT_NOT_FOUND');
  }
  console.log('   [PASS] Invalid parent rejected with PARENT_NOT_FOUND.\n');

  // --------------------------------------------------------------------------
  // TEST 8: Inactive Parent
  // --------------------------------------------------------------------------
  console.log('8. Testing Inactive Parent:');
  const inactiveParent = await createTestDist('InactivePar', rootDist.id, 'INACTIVE');
  const inactiveNode = await prisma.mLMNode.create({
    data: {
      distributorId: inactiveParent.dist.id,
      businessCenterId: inactiveParent.bc.id,
      depth: 1,
      binaryPath: 'ROOT/L',
    },
  });

  const res8 = await TreePlacementService.placeDistributor(candidate3.dist.id, inactiveNode.id, 'LEFT');

  console.log(`   - Result Success: ${res8.success}`);
  console.log(`   - Error Code: ${res8.code}`);

  if (res8.success !== false || res8.code !== 'PARENT_INACTIVE') {
    throw new Error('❌ Test 8 failed: Expected PARENT_INACTIVE');
  }
  console.log('   [PASS] Inactive parent rejected with PARENT_INACTIVE.\n');

  // --------------------------------------------------------------------------
  // TEST 9: Concurrent Placement Race Condition
  // --------------------------------------------------------------------------
  console.log('9. Testing Concurrent Placement Race Condition (Row-Locking & P2002 Protection):');
  // Create an open node with LEFT empty
  const openParent = await createTestDist('OpenParent');
  const openNode = await prisma.mLMNode.create({
    data: {
      distributorId: openParent.dist.id,
      businessCenterId: openParent.bc.id,
      depth: 1,
      binaryPath: 'ROOT/R',
    },
  });

  const competitorA = await createTestDist('CompetitorA', openParent.dist.id);
  const competitorB = await createTestDist('CompetitorB', openParent.dist.id);

  console.log('   Firing two simultaneous requests for the same open node on LEFT...');
  const [raceResultA, raceResultB] = await Promise.all([
    TreePlacementService.placeDistributor(competitorA.dist.id, openNode.id, 'LEFT'),
    TreePlacementService.placeDistributor(competitorB.dist.id, openNode.id, 'LEFT'),
  ]);

  console.log(`   - Request A Result: Success=${raceResultA.success}, Code=${raceResultA.code || 'SUCCESS'}`);
  console.log(`   - Request B Result: Success=${raceResultB.success}, Code=${raceResultB.code || 'SUCCESS'}`);

  const successCount = (raceResultA.success ? 1 : 0) + (raceResultB.success ? 1 : 0);
  const occupiedCount =
    (raceResultA.code === 'POSITION_ALREADY_OCCUPIED' ? 1 : 0) +
    (raceResultB.code === 'POSITION_ALREADY_OCCUPIED' ? 1 : 0);

  if (successCount !== 1 || occupiedCount !== 1) {
    throw new Error(`❌ Test 9 failed: Expected exactly 1 success and 1 POSITION_ALREADY_OCCUPIED, got ${successCount} successes`);
  }

  // Verify in PostgreSQL that exactly ONE child exists on LEFT
  const actualChildrenOnLeft = await prisma.mLMNode.count({
    where: {
      placementParentId: openNode.id,
      placementPosition: PlacementPosition.LEFT,
    },
  });

  if (actualChildrenOnLeft !== 1) {
    throw new Error(`❌ Database integrity breach: Found ${actualChildrenOnLeft} children on LEFT, expected 1!`);
  }
  console.log(`   ✅ PostgreSQL confirmed exactly 1 child on LEFT in database.`);
  console.log('   [PASS] Concurrent race condition properly resolved: 1 Winner, 1 Rejected.\n');

  // --------------------------------------------------------------------------
  // TEST 10: getAvailablePositions & getChildren
  // --------------------------------------------------------------------------
  console.log('10. Testing getAvailablePositions & getChildren:');
  const availableUnderRoot = await TreePlacementService.getAvailablePositions(rootNode.id);
  console.log(`   - Available positions under Root (both taken): ${JSON.stringify(availableUnderRoot)}`);
  if (availableUnderRoot.length !== 0) throw new Error('Expected [] under root');

  const childrenUnderRoot = await TreePlacementService.getChildren(rootNode.id);
  console.log(`   - Children count under Root: ${childrenUnderRoot.length}`);
  if (childrenUnderRoot.length !== 2) throw new Error('Expected 2 children under root');
  console.log(`   - Child 1 Position: ${childrenUnderRoot[0].placementPosition}`);
  console.log(`   - Child 2 Position: ${childrenUnderRoot[1].placementPosition}`);
  console.log('   [PASS] getAvailablePositions and getChildren verified.\n');

  // --------------------------------------------------------------------------
  // CLEANUP
  // --------------------------------------------------------------------------
  console.log('Cleaning up test records...');
  try {
    const allDistIds = [
      rootDist.id,
      childL.dist.id,
      childR.dist.id,
      candidate3.dist.id,
      candidate4.dist.id,
      inactiveParent.dist.id,
      openParent.dist.id,
      competitorA.dist.id,
      competitorB.dist.id,
    ];

    await prisma.mLMNode.deleteMany({ where: { distributorId: { in: allDistIds } } });
    await prisma.sponsorRelationship.deleteMany({ where: { ancestorId: { in: allDistIds } } });
    await prisma.sponsorRelationship.deleteMany({ where: { descendantId: { in: allDistIds } } });
    await prisma.businessCenter.deleteMany({ where: { distributorId: { in: allDistIds } } });
    await prisma.distributorProfile.deleteMany({ where: { id: { in: allDistIds } } });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            rootUser.id,
            childL.user.id,
            childR.user.id,
            candidate3.user.id,
            candidate4.user.id,
            inactiveParent.user.id,
            openParent.user.id,
            competitorA.user.id,
            competitorB.user.id,
          ],
        },
      },
    });
  } catch (cleanErr) {
    console.warn('Cleanup warning:', cleanErr);
  }

  console.log('===============================================================');
  console.log('🎉 ALL 9+ BINARY PLACEMENT TESTS PASSED 100% AGAINST POSTGRESQL!');
  console.log('===============================================================');
}

runPlacementVerification()
  .catch((e) => {
    console.error('Validation failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
