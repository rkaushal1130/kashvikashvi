import { prisma } from '../src/config/database';
import { EnrollmentService } from '../src/services/enrollment.service';
import { AppError } from '../src/utils/appError';

async function verifyEnrollmentIntegration() {
  console.log('=== VERIFYING PROMPT 5 ENROLLMENT & MLM TREE INTEGRATION ===\n');

  // Generate unique test email to avoid collisions
  const testEmail = `test.applicant.${Date.now()}@example.com`;
  const sponsorId = 'KV-DEMO-1005'; // Diana Prince (has node and available legs)

  console.log(`1. Testing Complete Direct Enrollment under sponsor ${sponsorId} (LEFT leg)...`);
  const enrollInput = {
    fullName: 'Ananya Deshmukh',
    email: testEmail,
    phone: '+91 98765 43210',
    dob: '1996-08-20',
    address: '102 Lotus Arcade, MG Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    country: 'India',
    sponsorId: sponsorId,
    placementParentId: sponsorId,
    placementPosition: 'LEFT' as const,
    enrollmentType: 'DISTRIBUTOR' as const,
    starterKitId: 'kit_pro',
    productPackage: 'Professional Activation Kit',
    price: 249.99,
    bv: 100,
    bankName: 'Axis Bank',
    accountNumber: '912010045678901',
    ifscCode: 'UTIB0000123',
    password: 'SecurePassword123!',
  };

  const result = await EnrollmentService.completeDirectEnrollment(enrollInput);
  console.log('Enrollment Success:');
  console.log(`- Created User ID: ${result.user.id} (${result.user.email})`);
  console.log(`- Created Distributor ID: ${result.distributor.distributorId} (${result.distributor.displayName})`);
  console.log(`- Sponsor: ${result.sponsor.displayName} (${result.sponsor.distributorId})`);
  console.log(`- Placed at: ${result.placement.position} of parent ${result.placement.placementParentDistributorId}`);
  console.log(`- Tree Depth: ${result.placement.depth}, Path: ${result.placement.binaryPath}`);
  console.log(`- Business Center: ${result.businessCenter.centerCode}`);

  // Verify directly in PostgreSQL
  console.log('\n2. Verifying database integrity across all 5 models...');
  const user = await prisma.user.findUnique({ where: { id: result.user.id } });
  const dist = await prisma.distributorProfile.findUnique({ where: { id: result.distributor.id } });
  const node = await prisma.mLMNode.findUnique({ where: { id: result.placement.nodeId } });
  const bc = await prisma.businessCenter.findUnique({ where: { id: result.businessCenter.id } });
  const sponsorRel = await prisma.sponsorRelationship.findFirst({
    where: { ancestorId: result.sponsor.id, descendantId: result.distributor.id, isDirect: true },
  });

  if (!user || !dist || !node || !bc || !sponsorRel) {
    throw new Error('Database verification failed: missing created entity!');
  }
  console.log('✓ All 5 database records confirmed in PostgreSQL.');

  console.log('\n3. Testing Collision Protection (attempting duplicate LEFT placement under same parent)...');
  const collisionEmail = `collision.applicant.${Date.now()}@example.com`;
  let collisionBlocked = false;
  try {
    await EnrollmentService.completeDirectEnrollment({
      ...enrollInput,
      email: collisionEmail,
      fullName: 'Collision Tester',
    });
  } catch (err: any) {
    if (err.code === 'POSITION_ALREADY_OCCUPIED') {
      collisionBlocked = true;
      console.log(`✓ Collision successfully blocked with code: ${err.code} ("${err.message}")`);
    } else {
      console.error('Unexpected error on collision test:', err);
    }
  }

  if (!collisionBlocked) {
    throw new Error('Collision protection failed: duplicate placement was allowed!');
  }

  // Verify rollback: collision user must NOT exist
  const orphanUser = await prisma.user.findUnique({ where: { email: collisionEmail } });
  if (orphanUser) {
    throw new Error('Rollback failed: orphaned user was committed!');
  }
  console.log('✓ Transaction Rollback verified: zero orphaned users or distributors created.');

  console.log('\n4. Testing Full Parent Rejection (attempting placement under Rahul Kaushal KV-1001)...');
  let fullParentBlocked = false;
  try {
    await EnrollmentService.completeDirectEnrollment({
      ...enrollInput,
      email: `full.parent.test.${Date.now()}@example.com`,
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1001',
      placementPosition: 'LEFT',
    });
  } catch (err: any) {
    if (err.code === 'POSITION_ALREADY_OCCUPIED') {
      fullParentBlocked = true;
      console.log(`✓ Full leg under KV-1001 correctly rejected: ${err.code}`);
    }
  }

  if (!fullParentBlocked) {
    throw new Error('Full parent check failed: placement was allowed under full node!');
  }

  console.log('\n========================================================');
  console.log('>>> ENROLLMENT & MLM TREE INTEGRATION: VERIFIED 100% <<<');
  console.log('========================================================\n');
}

verifyEnrollmentIntegration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
