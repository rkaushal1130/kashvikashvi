import { maskAccountNumber, maskEmail, maskIfsc, maskPhone, sanitizeEnrollmentResponse } from '../src/utils/masking';
import { hashPassword, verifyPassword } from '../src/utils/password';
import {
  createEnrollmentSchema,
  step1PersonalInfoSchema,
  step2AddressSchema,
  step3TreePlacementSchema,
  step4StarterKitSchema,
  step5BankSecuritySchema,
} from '../src/validators/enrollment.validators';
import { EnrollmentService } from '../src/services/enrollment.service';

async function main() {
  console.log('=== RUNNING ENROLLMENT VERIFICATION TEST SUITE ===\n');

  // Test 1: Masking
  console.log('1. Testing Data Masking Utilities:');
  const maskedAcc = maskAccountNumber('987654321098');
  console.log(`   - maskAccountNumber('987654321098') => '${maskedAcc}'`);
  if (!maskedAcc.endsWith('1098') || !maskedAcc.includes('****')) {
    throw new Error('maskAccountNumber failed');
  }

  const maskedIfsc = maskIfsc('SBIN0001234');
  console.log(`   - maskIfsc('SBIN0001234') => '${maskedIfsc}'`);
  if (!maskedIfsc.startsWith('SBIN') || !maskedIfsc.endsWith('34')) {
    throw new Error('maskIfsc failed');
  }

  const maskedEmail = maskEmail('rahul.kaushal@example.com');
  console.log(`   - maskEmail('rahul.kaushal@example.com') => '${maskedEmail}'`);
  if (!maskedEmail.includes('@example.com')) {
    throw new Error('maskEmail failed');
  }
  console.log('   [PASS] Masking utilities verified.\n');

  // Test 2: Argon2id Hashing
  console.log('2. Testing Argon2id PIN & Password Hashing:');
  const pin = '4829';
  const hashedPin = await hashPassword(pin);
  console.log(`   - Argon2id hash: ${hashedPin.substring(0, 30)}...`);
  if (!hashedPin.startsWith('$argon2id$')) {
    throw new Error('Hash is not Argon2id');
  }
  const match = await verifyPassword(pin, hashedPin);
  if (!match) throw new Error('Argon2id verification returned false for valid PIN');
  const wrongMatch = await verifyPassword('0000', hashedPin);
  if (wrongMatch) throw new Error('Argon2id verification returned true for invalid PIN');
  console.log('   [PASS] Argon2id hashing & verification verified.\n');

  // Test 3: Zod Schemas
  console.log('3. Testing Step 1 to 5 Zod Schemas:');
  // Step 1: Adult (>= 18)
  const s1Ok = step1PersonalInfoSchema.safeParse({
    legalName: 'Alexander Hamilton',
    email: 'alex@example.com',
    mobile: '+1 (555) 234-5678',
    dateOfBirth: '1995-01-11',
  });
  if (!s1Ok.success) throw new Error('Step 1 failed on valid data: ' + JSON.stringify(s1Ok.error));

  // Step 1: Underage rejection
  const s1Underage = step1PersonalInfoSchema.safeParse({
    legalName: 'Child User',
    email: 'child@example.com',
    mobile: '5551234567',
    dateOfBirth: '2015-05-15',
  });
  if (s1Underage.success) throw new Error('Step 1 failed to reject underage applicant');
  console.log('   - Step 1 (Personal Info & Age >= 18): PASS');

  // Step 2: Address
  const s2Ok = step2AddressSchema.safeParse({
    address: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'OR',
    country: 'USA',
    postalCode: '97477',
  });
  if (!s2Ok.success) throw new Error('Step 2 failed on valid address');
  console.log('   - Step 2 (Address & PIN): PASS');

  // Step 3: Tree Placement
  const s3Ok = step3TreePlacementSchema.safeParse({
    sponsor: 'DST-10001',
    placementParent: 'DST-10002',
    placementPosition: 'LEFT',
  });
  if (!s3Ok.success) throw new Error('Step 3 failed on valid placement');

  const s3InvalidPos = step3TreePlacementSchema.safeParse({
    sponsor: 'DST-10001',
    placementParent: 'DST-10002',
    placementPosition: 'MIDDLE' as any,
  });
  if (s3InvalidPos.success) throw new Error('Step 3 allowed invalid placementPosition');
  console.log('   - Step 3 (Tree Placement LEFT/RIGHT): PASS');

  // Step 4: Starter Kit
  const s4Ok = step4StarterKitSchema.safeParse({
    productPackage: 'Executive Business Enrollment Pack',
    price: 249.99,
    bv: 200,
  });
  if (!s4Ok.success) throw new Error('Step 4 failed on valid starter kit');

  const s4BadPrice = step4StarterKitSchema.safeParse({
    productPackage: 'Free Kit',
    price: -50,
    bv: 0,
  });
  if (s4BadPrice.success) throw new Error('Step 4 allowed negative price');
  console.log('   - Step 4 (Starter Kit Price & BV): PASS');

  // Step 5: Bank & Security
  const s5Ok = step5BankSecuritySchema.safeParse({
    accountHolder: 'Alexander Hamilton',
    bankName: 'JPMorgan Chase',
    accountNumber: '987654321098',
    ifsc: 'CHASUS33',
    securityPin: '4829',
  });
  if (!s5Ok.success) throw new Error('Step 5 failed on valid bank details');

  const s5BadPin = step5BankSecuritySchema.safeParse({
    accountHolder: 'Alexander Hamilton',
    bankName: 'Chase',
    accountNumber: '987654321',
    ifsc: 'CHASUS33',
    securityPin: 'abcd', // Non-numeric
  });
  if (s5BadPin.success) throw new Error('Step 5 allowed non-numeric security PIN');
  console.log('   - Step 5 (Bank & Security PIN): PASS');

  // Test 4: Sanitization
  console.log('\n4. Testing Enrollment Response Sanitization:');
  const rawEnrollment = {
    id: 'mock-id-123',
    enrollmentNumber: 'ENR-123456',
    securityPinHash: '$argon2id$v=19$m=65536,t=3,p=1$secret_hash',
    steps: [
      { stepNumber: 1, stepName: 'Personal Info', stepData: { email: 'user@test.com' } },
      {
        stepNumber: 5,
        stepName: 'Bank & Security',
        stepData: {
          accountHolder: 'John Doe',
          accountNumber: '987654321098',
          ifsc: 'CHASUS33',
          securityPin: '4829',
          securityPinHash: 'secret_hash',
        },
      },
    ],
  };

  const sanitized = sanitizeEnrollmentResponse(rawEnrollment);
  if (sanitized.securityPinHash) throw new Error('securityPinHash was not stripped from root');
  const step5 = sanitized.steps[1];
  if (step5.stepData.securityPin) throw new Error('Raw securityPin was exposed');
  if (step5.stepData.securityPinHash) throw new Error('securityPinHash was exposed in stepData');
  if (step5.stepData.accountNumber !== '********1098') {
    throw new Error('Account number was not properly masked: ' + step5.stepData.accountNumber);
  }
  if (!step5.stepData.pinConfigured) throw new Error('pinConfigured flag missing');
  console.log('   [PASS] Sanitization safely stripped hashes, PINs, and masked bank accounts.\n');

  console.log('5. Testing EnrollmentService API Methods:');
  const methods = [
    'createEnrollment',
    'getEnrollmentById',
    'updateEnrollment',
    'saveStep1',
    'saveStep2',
    'saveStep3',
    'saveStep4',
    'saveStep5',
    'submitEnrollment',
  ];
  for (const m of methods) {
    if (typeof (EnrollmentService as any)[m] !== 'function') {
      throw new Error(`EnrollmentService.${m} is not defined as a function`);
    }
    console.log(`   - EnrollmentService.${m}: READY`);
  }

  // Test 6: Product Catalog & Category Tests
  console.log('\n6. Testing Product Catalog & Category Schemas:');
  const {
    createProductSchema,
    productQuerySchema,
    productStatusEnum,
    productSortEnum,
  } = await import('../src/validators/product.validators');
  const { ProductService, slugify } = await import('../src/services/product.service');

  // Slugify test
  const testSlug = slugify('ActiveFit Compression Hosiery Pro!');
  if (testSlug !== 'activefit-compression-hosiery-pro') {
    throw new Error(`Slugify failed: expected 'activefit-compression-hosiery-pro', got '${testSlug}'`);
  }
  console.log(`   - slugify('ActiveFit Compression Hosiery Pro!') => '${testSlug}' [PASS]`);

  // Product Statuses check
  for (const status of ['DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'INACTIVE']) {
    if (!productStatusEnum.safeParse(status).success) {
      throw new Error(`Product status '${status}' failed validation`);
    }
  }
  console.log('   - Product statuses (DRAFT, ACTIVE, OUT_OF_STOCK, INACTIVE): [PASS]');

  // Product Sort Options check
  for (const sort of ['featured', 'newest', 'price_low', 'price_high', 'BV']) {
    if (!productSortEnum.safeParse(sort).success) {
      throw new Error(`Sort option '${sort}' failed validation`);
    }
  }
  console.log('   - Product sort options (featured, newest, price_low, price_high, BV): [PASS]');

  // Validate CLOTHES_HOSIERY Product
  const clothesProduct = createProductSchema.safeParse({
    sku: 'CLO-COMP-001',
    name: 'ActiveFit Graduated Compression Hosiery Pro',
    categoryId: 'CLOTHES_HOSIERY',
    wholesalePrice: 29.99,
    mrp: 49.99,
    bv: 25.0,
    stock: 500,
    lowStockThreshold: 30,
    status: 'ACTIVE',
    isFeatured: true,
    images: ['https://images.example.com/hosiery.jpg'],
  });
  if (!clothesProduct.success) {
    throw new Error('Clothes product validation failed: ' + JSON.stringify(clothesProduct.error));
  }
  console.log('   - Product creation validation (CLOTHES_HOSIERY): [PASS]');

  // Validate ELECTRONICS_SMART_DEVICES Product
  const electronicsProduct = createProductSchema.safeParse({
    sku: 'ELE-BAND-001',
    name: 'Kashvi Smart Vitality Health Band 4',
    categoryId: 'ELECTRONICS_SMART_DEVICES',
    wholesalePrice: 89.99,
    mrp: 149.99,
    bv: 75.0,
    stock: 250,
    lowStockThreshold: 25,
    status: 'ACTIVE',
    isFeatured: true,
  });
  if (!electronicsProduct.success) {
    throw new Error('Electronics product validation failed: ' + JSON.stringify(electronicsProduct.error));
  }
  console.log('   - Product creation validation (ELECTRONICS_SMART_DEVICES): [PASS]');

  // Validate Query Filters
  const queryFilter = productQuerySchema.safeParse({
    category: 'clothes-hosiery',
    search: 'compression',
    minPrice: 20,
    maxPrice: 100,
    minBV: 15,
    stock: 'in_stock',
    sort: 'price_low',
    page: 1,
    limit: 20,
  });
  if (!queryFilter.success) {
    throw new Error('Product query filters validation failed');
  }
  console.log('   - Product query filters & sorting validation: [PASS]');

  // Verify ProductService Methods
  const productMethods = [
    'getProducts',
    'getProductBySlug',
    'createProduct',
    'updateProduct',
    'deleteProduct',
    'getCategories',
    'ensureDefaultCategories',
  ];
  for (const pm of productMethods) {
    if (typeof (ProductService as any)[pm] !== 'function') {
      throw new Error(`ProductService.${pm} is not defined as a function`);
    }
    console.log(`   - ProductService.${pm}: READY`);
  }

  // Test 7: Shopping Cart & Order Management Tests
  console.log('\n7. Testing Shopping Cart & Order Management:');
  const {
    addToCartSchema,
    updateCartItemSchema,
  } = await import('../src/validators/cart.validators');
  const {
    createOrderSchema,
    orderItemInputSchema,
    orderStatusEnum,
  } = await import('../src/validators/order.validators');
  const { CartService } = await import('../src/services/cart.service');
  const { OrderService } = await import('../src/services/order.service');

  // Cart validations
  const validAddToCart = addToCartSchema.safeParse({
    productId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    quantity: 2,
  });
  if (!validAddToCart.success) throw new Error('addToCartSchema failed on valid data');

  const invalidCartQty = addToCartSchema.safeParse({
    productId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    quantity: 0,
  });
  if (invalidCartQty.success) throw new Error('addToCartSchema accepted 0 quantity');
  console.log('   - Cart item validation (productId UUID, positive quantity): [PASS]');

  // Order statuses check
  const expectedOrderStatuses = [
    'PENDING',
    'PAYMENT_PENDING',
    'PAID',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ];
  for (const st of expectedOrderStatuses) {
    if (!orderStatusEnum.safeParse(st).success) {
      throw new Error(`Order status '${st}' failed validation`);
    }
  }
  console.log('   - Order statuses (PENDING, PAYMENT_PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED): [PASS]');

  // Frontend tampering protection check: orderItemInputSchema MUST NOT accept price or BV
  const clientInput = {
    productId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    quantity: 2,
    unitPrice: 0.01, // attempted tampering
    unitBV: 99999,   // attempted tampering
  };
  const parsedItem = orderItemInputSchema.parse(clientInput);
  if ((parsedItem as any).unitPrice !== undefined || (parsedItem as any).unitBV !== undefined) {
    throw new Error('Security violation: orderItemInputSchema accepted client-supplied price/BV!');
  }
  console.log('   - Security check: Frontend price/BV tampering rejected: [PASS]');

  // Verify CartService methods
  const cartMethods = ['getOrCreateCart', 'addItem', 'updateItem', 'removeItem', 'clearCart'];
  for (const cm of cartMethods) {
    if (typeof (CartService as any)[cm] !== 'function') {
      throw new Error(`CartService.${cm} is not defined as a function`);
    }
    console.log(`   - CartService.${cm}: READY`);
  }

  // Verify OrderService methods
  const orderMethods = ['createOrder', 'getOrders', 'getOrderById', 'cancelOrder'];
  for (const om of orderMethods) {
    if (typeof (OrderService as any)[om] !== 'function') {
      throw new Error(`OrderService.${om} is not defined as a function`);
    }
    console.log(`   - OrderService.${om}: READY`);
  }

  // Test 8: Immutable BV Ledger & BVService Tests
  const { runBVLedgerTests } = await import('./bv.test');
  await runBVLedgerTests();

  // Test 9: Commission Engine & Database-Driven Rules
  const { runCommissionEngineTests } = await import('./commission.test');
  await runCommissionEngineTests();

  // Test 10: CommissionPeriod & Admin Control Engine
  const { runCommissionPeriodTests } = await import('./commissionPeriod.test');
  await runCommissionPeriodTests();

  // Test 11: Distributor Wallet & Transaction Ledger
  const { runWalletTests } = await import('./wallet.test');
  await runWalletTests();

  // Test 12: Payout System & Masked Banking Security
  const { runPayoutTests } = await import('./payout.test');
  await runPayoutTests();

  // Test 13: Multi-Center Business Architecture & Independent Tree Isolation
  const { runBusinessCenterTests } = await import('./businessCenter.test');
  await runBusinessCenterTests();

  // Test 14: Training System, Course Categories & Progress Engine
  const { runTrainingTests } = await import('./training.test');
  await runTrainingTests();

  // Test 15: Replicated Distributor Website & Navigation Links
  const { runWebsiteTests } = await import('./website.test');
  await runWebsiteTests();

  // Test 16: News Management (Public & Admin)
  const { runNewsTests } = await import('./news.test');
  await runNewsTests();

  console.log('\n======================================================================================================================================================================');
  console.log('>>> ALL VERIFICATIONS (ENROLLMENT + PRODUCTS + CART + ORDERS + BV + COMMISSIONS + PERIODS + WALLET + PAYOUTS + BUSINESS CENTERS + TRAINING + WEBSITE + NEWS) PASSED! <<<');
  console.log('======================================================================================================================================================================');
}

main().catch((err) => {
  console.error('\nVerification failed with error:', err);
  process.exit(1);
});
