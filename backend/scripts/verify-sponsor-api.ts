import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { PlacementPosition } from '@prisma/client';

async function runSponsorApiVerification() {
  console.log('===============================================================');
  console.log('🧪 VERIFYING SPONSOR VALIDATION API (GET /api/v1/sponsors/:sponsorId)');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Valid Sponsor (Rahul - KV-1001)
  // --------------------------------------------------------------------------
  console.log('1. Testing Valid Sponsor (Rahul - KV-1001):');
  const res1 = await request(app).get('/api/v1/sponsors/KV-1001');

  console.log(`   - HTTP Status: ${res1.status}`);
  console.log(`   - Response Body: ${JSON.stringify(res1.body, null, 2)}`);

  if (res1.status !== 200 || !res1.body.success) {
    throw new Error('❌ Test 1 failed: Expected status 200 and success true');
  }
  if (res1.body.data.sponsor.distributorId !== 'KV-1001') {
    throw new Error('❌ Test 1 failed: Expected distributorId KV-1001');
  }
  if (res1.body.data.sponsor.status !== 'ACTIVE') {
    throw new Error('❌ Test 1 failed: Expected status ACTIVE');
  }
  console.log('   [PASS] Valid sponsor retrieved successfully.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Invalid Sponsor
  // --------------------------------------------------------------------------
  console.log('2. Testing Invalid Sponsor (KV-NONEXISTENT-9999):');
  const res2 = await request(app).get('/api/v1/sponsors/KV-NONEXISTENT-9999');

  console.log(`   - HTTP Status: ${res2.status}`);
  console.log(`   - Response Body: ${JSON.stringify(res2.body, null, 2)}`);

  if (res2.status !== 404 || res2.body.success !== false || res2.body.code !== 'SPONSOR_NOT_FOUND') {
    throw new Error('❌ Test 2 failed: Expected status 404 and code SPONSOR_NOT_FOUND');
  }
  console.log('   [PASS] Invalid sponsor correctly returned 404 SPONSOR_NOT_FOUND.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Inactive Sponsor
  // --------------------------------------------------------------------------
  console.log('3. Testing Inactive Sponsor:');
  const inactiveUser = await prisma.user.create({
    data: {
      email: `inactive.sponsor.${Date.now()}@example.com`,
      passwordHash: 'dummy_hash',
      roleName: 'DISTRIBUTOR',
    },
  });

  const inactiveDistributor = await prisma.distributorProfile.create({
    data: {
      userId: inactiveUser.id,
      distributorCode: `KV-INACTIVE-${Date.now()}`,
      distributorId: `KV-INACTIVE-${Date.now()}`,
      firstName: 'Suresh',
      lastName: 'Inactive',
      displayName: 'Suresh Inactive',
      status: 'INACTIVE',
    },
  });

  const res3 = await request(app).get(`/api/v1/sponsors/${inactiveDistributor.distributorCode}`);
  console.log(`   - HTTP Status: ${res3.status}`);
  console.log(`   - Response Body: ${JSON.stringify(res3.body, null, 2)}`);

  if (res3.status !== 400 || res3.body.success !== false || res3.body.code !== 'SPONSOR_INACTIVE') {
    throw new Error('❌ Test 3 failed: Expected status 400 and code SPONSOR_INACTIVE');
  }
  console.log('   [PASS] Inactive sponsor correctly returned 400 SPONSOR_INACTIVE.\n');

  // --------------------------------------------------------------------------
  // SETUP TEST DISTRIBUTORS FOR SCENARIOS 4, 5, 6, 7
  // --------------------------------------------------------------------------
  console.log('Setting up binary nodes for position tests...');
  const testUser = await prisma.user.create({
    data: {
      email: `pos.test.${Date.now()}@example.com`,
      passwordHash: 'dummy_hash',
      roleName: 'DISTRIBUTOR',
    },
  });

  const testDistCode = `KV-POS-${Date.now()}`;
  const testDistributor = await prisma.distributorProfile.create({
    data: {
      userId: testUser.id,
      distributorCode: testDistCode,
      distributorId: testDistCode,
      firstName: 'Pooja',
      lastName: 'Sharma',
      displayName: 'Pooja Sharma',
      status: 'ACTIVE',
    },
  });

  const testBC = await prisma.businessCenter.create({
    data: {
      distributorId: testDistributor.id,
      centerCode: `${testDistCode}-BC1`,
      status: 'ACTIVE',
    },
  });

  const testNode = await prisma.mLMNode.create({
    data: {
      distributorId: testDistributor.id,
      businessCenterId: testBC.id,
      placementPosition: null,
      depth: 0,
    },
  });

  // --------------------------------------------------------------------------
  // TEST 4: Sponsor with No Children (both LEFT & RIGHT available)
  // --------------------------------------------------------------------------
  console.log('4. Testing Sponsor with No Children:');
  const res4 = await request(app).get(`/api/v1/sponsors/${testDistCode}`);
  console.log(`   - Available Positions: ${JSON.stringify(res4.body.data.availablePositions)}`);

  const pos4 = res4.body.data.availablePositions;
  if (!pos4.includes('LEFT') || !pos4.includes('RIGHT') || pos4.length !== 2) {
    throw new Error('❌ Test 4 failed: Expected ["LEFT", "RIGHT"]');
  }
  console.log('   [PASS] Sponsor with 0 children has both ["LEFT", "RIGHT"] available.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Sponsor with LEFT Occupied (only RIGHT available)
  // --------------------------------------------------------------------------
  console.log('5. Testing Sponsor with LEFT Occupied:');
  // Add a child on LEFT
  const childLeftUser = await prisma.user.create({
    data: { email: `child.left.${Date.now()}@example.com`, passwordHash: 'hash', roleName: 'DISTRIBUTOR' },
  });
  const childLeftDist = await prisma.distributorProfile.create({
    data: {
      userId: childLeftUser.id,
      distributorCode: `KV-CL-${Date.now()}`,
      distributorId: `KV-CL-${Date.now()}`,
      firstName: 'Child',
      lastName: 'Left',
      status: 'ACTIVE',
    },
  });
  const childLeftBC = await prisma.businessCenter.create({
    data: { distributorId: childLeftDist.id, centerCode: `BC-CL-${Date.now()}`, status: 'ACTIVE' },
  });
  const childLeftNode = await prisma.mLMNode.create({
    data: {
      distributorId: childLeftDist.id,
      businessCenterId: childLeftBC.id,
      placementParentId: testNode.id,
      placementPosition: PlacementPosition.LEFT,
    },
  });

  const res5 = await request(app).get(`/api/v1/sponsors/${testDistCode}`);
  console.log(`   - Available Positions: ${JSON.stringify(res5.body.data.availablePositions)}`);

  if (res5.body.data.availablePositions.length !== 1 || res5.body.data.availablePositions[0] !== 'RIGHT') {
    throw new Error('❌ Test 5 failed: Expected only ["RIGHT"]');
  }
  console.log('   [PASS] Sponsor with LEFT occupied correctly returns ["RIGHT"].\n');

  // --------------------------------------------------------------------------
  // TEST 6: Sponsor with RIGHT Occupied (only LEFT available)
  // --------------------------------------------------------------------------
  console.log('6. Testing Sponsor with RIGHT Occupied:');
  // Swap child from LEFT to RIGHT
  await prisma.mLMNode.update({
    where: { id: childLeftNode.id },
    data: { placementPosition: PlacementPosition.RIGHT },
  });

  const res6 = await request(app).get(`/api/v1/sponsors/${testDistCode}`);
  console.log(`   - Available Positions: ${JSON.stringify(res6.body.data.availablePositions)}`);

  if (res6.body.data.availablePositions.length !== 1 || res6.body.data.availablePositions[0] !== 'LEFT') {
    throw new Error('❌ Test 6 failed: Expected only ["LEFT"]');
  }
  console.log('   [PASS] Sponsor with RIGHT occupied correctly returns ["LEFT"].\n');

  // --------------------------------------------------------------------------
  // TEST 7: Sponsor with Both Positions Occupied (Empty Array)
  // --------------------------------------------------------------------------
  console.log('7. Testing Sponsor with Both Positions Occupied:');
  // Put childLeft back to LEFT, and add childRight on RIGHT
  await prisma.mLMNode.update({
    where: { id: childLeftNode.id },
    data: { placementPosition: PlacementPosition.LEFT },
  });

  const childRightUser = await prisma.user.create({
    data: { email: `child.right.${Date.now()}@example.com`, passwordHash: 'hash', roleName: 'DISTRIBUTOR' },
  });
  const childRightDist = await prisma.distributorProfile.create({
    data: {
      userId: childRightUser.id,
      distributorCode: `KV-CR-${Date.now()}`,
      distributorId: `KV-CR-${Date.now()}`,
      firstName: 'Child',
      lastName: 'Right',
      status: 'ACTIVE',
    },
  });
  const childRightBC = await prisma.businessCenter.create({
    data: { distributorId: childRightDist.id, centerCode: `BC-CR-${Date.now()}`, status: 'ACTIVE' },
  });
  const childRightNode = await prisma.mLMNode.create({
    data: {
      distributorId: childRightDist.id,
      businessCenterId: childRightBC.id,
      placementParentId: testNode.id,
      placementPosition: PlacementPosition.RIGHT,
    },
  });

  const res7 = await request(app).get(`/api/v1/sponsors/${testDistCode}`);
  console.log(`   - Available Positions: ${JSON.stringify(res7.body.data.availablePositions)}`);

  if (res7.body.data.availablePositions.length !== 0) {
    throw new Error('❌ Test 7 failed: Expected empty array []');
  }
  console.log('   [PASS] Sponsor with both positions occupied returns [].\n');

  // Also test with Rahul (KV-1001) who has Amit on LEFT and Rohit on RIGHT in seed data
  console.log('   Also verifying Seeded Rahul (KV-1001) with both children occupied:');
  const res7Rahul = await request(app).get('/api/v1/sponsors/KV-1001');
  console.log(`   - Rahul Available Positions: ${JSON.stringify(res7Rahul.body.data.availablePositions)}`);
  if (res7Rahul.body.data.availablePositions.length !== 0) {
    throw new Error('❌ Rahul expected to have [] available positions');
  }
  console.log('   [PASS] Seeded Rahul (KV-1001) verified with [] available positions.\n');

  // --------------------------------------------------------------------------
  // TEST 8: Privacy Leak Check
  // --------------------------------------------------------------------------
  console.log('8. Privacy Guard Verification:');
  const sponsorFields = Object.keys(res1.body.data.sponsor);
  console.log(`   - Exposed Sponsor Fields: ${JSON.stringify(sponsorFields)}`);
  const forbiddenFields = ['email', 'phone', 'password', 'passwordHash', 'wallet', 'bankAccounts', 'dateOfBirth'];
  for (const field of forbiddenFields) {
    if (field in res1.body.data.sponsor) {
      throw new Error(`❌ Privacy breach: Found private field '${field}' in response!`);
    }
  }
  console.log('   [PASS] Zero private or sensitive information exposed.\n');

  // Cleanup temporary test records
  console.log('Cleaning up temporary test records...');
  try {
    await prisma.mLMNode.delete({ where: { id: childRightNode.id } });
    await prisma.businessCenter.delete({ where: { id: childRightBC.id } });
    await prisma.distributorProfile.delete({ where: { id: childRightDist.id } });
    await prisma.user.delete({ where: { id: childRightUser.id } });

    await prisma.mLMNode.delete({ where: { id: childLeftNode.id } });
    await prisma.businessCenter.delete({ where: { id: childLeftBC.id } });
    await prisma.distributorProfile.delete({ where: { id: childLeftDist.id } });
    await prisma.user.delete({ where: { id: childLeftUser.id } });

    await prisma.mLMNode.delete({ where: { id: testNode.id } });
    await prisma.businessCenter.delete({ where: { id: testBC.id } });
    await prisma.distributorProfile.delete({ where: { id: testDistributor.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    await prisma.distributorProfile.delete({ where: { id: inactiveDistributor.id } });
    await prisma.user.delete({ where: { id: inactiveUser.id } });
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }

  console.log('===============================================================');
  console.log('🎉 ALL 7 SPONSOR VALIDATION TESTS PASSED 100% AGAINST POSTGRES!');
  console.log('===============================================================');
}

runSponsorApiVerification()
  .catch((err) => {
    console.error('Validation script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
