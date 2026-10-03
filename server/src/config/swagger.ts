import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'KashviMLM Enterprise REST API Specification',
    version: '1.0.0',
    description: `### Enterprise Multi-Level Marketing (MLM) & E-Commerce Platform API

Powered by **Node.js, Express, TypeScript, PostgreSQL, and Prisma ORM**.

#### Key Architecture & Capabilities:
- **Authentication & Security:** Argon2id hashing, JWT access tokens (15m), rotating refresh tokens (7d), double-submit CSRF cookie validation, distributed request correlation IDs (\`X-Request-ID\`), rate limiting, and brute-force lockout defenses.
- **MLM Compensation Engine:** Dual-leg binary matrix compensation, 10% matching bonuses, business volume (BV) accumulation, multi-center tracking (BC-01, BC-02, BC-03), and weekly automated payout settlement batches.
- **Direct Selling Catalog:** Real-time MRP vs. Distributor Price (DP) calculations, volume BV points, instant inventory deduction, and ID Owner (Rahul Kaushal: 88767139) publication controls.
- **Auditability & Compliance:** Immutable compliance audit logging across all critical state-mutating actions with actor tracking, before/after diffs, and anti-tamper deletion guards.

#### Security & Authorization Policy:
- **Zero-Trust Frontend IDs:** Protected endpoints strictly verify the authenticated user's session token (\`req.user.memberId\` / \`req.user.id\`). Client-supplied IDs are cross-checked for ownership; spoofed IDs are rejected with \`403 Forbidden\`.
- **Role Enforcement:** Administrative endpoints require the verified \`admin\` role or ID Owner privileges (\`memberId: 88767139\`).`,
    contact: {
      name: 'KashviMLM Engineering & Support Team',
      email: 'kashvicustomercare@gmail.com',
      url: 'https://kashvimlm.com',
    },
    license: {
      name: 'Proprietary - Kashvi Vadic Lifestyle Pvt. Ltd.',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development & Test Server',
    },
    {
      url: 'https://api.kashvimlm.com',
      description: 'Production Live Gateway (HTTPS Required)',
    },
  ],
  tags: [
    { name: '1. Authentication', description: 'Session management, JWT authentication, token rotation, and password recovery' },
    { name: '2. Distributor', description: 'Distributor profiles, rank qualification, KYC document verification, and banking details' },
    { name: '3. Enrollment', description: 'Sponsor identity validation and downline distributor registration into binary tree' },
    { name: '4. Products', description: 'Wholesale product catalog with DP, MRP, BV points, and ID Owner catalog management' },
    { name: '5. Cart', description: 'Distributor wholesale shopping cart, volume BV accumulation, and checkout validation' },
    { name: '6. Orders', description: 'Wholesale order checkout, invoice generation, status tracking, and order history' },
    { name: '7. BV', description: 'Personal Sales Volume (PSV) and Group Business Volume (GBV) calculation and ledgers' },
    { name: '8. Commission', description: 'Dual-leg binary matching bonus calculation (10%) and weekly earnings history' },
    { name: '9. Wallet', description: 'e-Wallet ledger balances, credit/debit transactions, and bank payout withdrawals' },
    { name: '10. Payout', description: 'Distributor payout history, bank transfer records, and automated batch generation' },
    { name: '11. Business Centers', description: 'Tri-center hierarchy (BC-01, BC-02, BC-03), binary matrix tree, and placement' },
    { name: '12. Training', description: 'Distributor onboarding courses, compliance certifications, and module completion' },
    { name: '13. Website', description: 'Public company information, executive leadership, legal certifications, and hero banners' },
    { name: '14. News', description: 'Corporate announcements, product drops, contest circulars, and marquee ticker items' },
    { name: '15. Support', description: 'Helpdesk ticketing, priority escalation, and real-time threaded message replies' },
    { name: '16. Notifications', description: 'System, commission, order, payout, and broadcast announcements with unread counts' },
    { name: '17. Admin', description: 'Executive operational overview, live metrics, immutable audit logs, and bulk settlements' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your signed JWT Access Token (15-minute expiry) in the format `Bearer <token>`.',
      },
      CookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'HTTP-only secure cookie containing rotating refresh token for token exchange.',
      },
    },
    schemas: {
      // Standardized Envelope Schemas
      StandardError: {
        type: 'object',
        required: ['success', 'message', 'requestId'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Operation failed or resource not found.' },
          requestId: { type: 'string', format: 'uuid', example: 'd3b07384-d113-4f51-b76b-9c7ef95180f9' },
        },
      },
      ValidationError: {
        type: 'object',
        required: ['success', 'message', 'errors', 'requestId'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Request payload validation failed.' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'Invalid email address format' },
              },
            },
          },
          requestId: { type: 'string', format: 'uuid', example: 'e4c18495-e224-4a62-c87c-0d8fa06291a0' },
        },
      },

      // 1. Authentication
      LoginRequest: {
        type: 'object',
        required: ['username', 'password', 'sponsorId'],
        properties: {
          username: { type: 'string', description: 'Member ID (e.g. 88767139), username, or registered email', example: '88767139' },
          password: { type: 'string', minLength: 6, format: 'password', example: 'SecurePassword123!' },
          sponsorId: { type: 'string', description: 'Sponsoring Distributor Member ID', example: '88767139' },
          rememberMe: { type: 'boolean', default: false, example: true },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Login successful.' },
          token: { type: 'string', description: 'JWT Access Token (15-minute validity)', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
          refreshToken: { type: 'string', description: 'Rotating Refresh Token (7-day validity)', example: 'a8f5f167b...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'usr-001' },
              username: { type: 'string', example: 'rahul_kaushal' },
              email: { type: 'string', example: 'rahul.kaushal@kashvimlm.com' },
              role: { type: 'string', enum: ['distributor', 'admin', 'customer'], example: 'distributor' },
              memberId: { type: 'string', example: '88767139' },
              fullName: { type: 'string', example: 'Rahul Kaushal' },
              rank: { type: 'string', example: 'Diamond Director' },
              qualificationStatus: { type: 'string', example: 'Active' },
            },
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['fullName', 'email', 'phone', 'password', 'confirmPassword'],
        properties: {
          fullName: { type: 'string', minLength: 3, maxLength: 100, example: 'Rahul Kaushal' },
          email: { type: 'string', format: 'email', example: 'rahul.kaushal@kashvimlm.com' },
          phone: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', example: '+919876543210' },
          username: { type: 'string', minLength: 3, maxLength: 30, example: 'rahul_kaushal' },
          password: { type: 'string', minLength: 8, format: 'password', example: 'SecurePass2026!' },
          confirmPassword: { type: 'string', minLength: 8, format: 'password', example: 'SecurePass2026!' },
          sponsorId: { type: 'string', description: 'Valid Sponsoring Member ID', default: '88767139', example: '88767139' },
          placementLeg: { type: 'string', enum: ['Left', 'Right', 'Auto'], default: 'Auto', example: 'Left' },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string', description: 'Active refresh token. Optional if sent in HTTP-only cookie.', example: 'b94e6341...' },
        },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: { type: 'string', description: 'Registered Email or Member ID', example: 'rahul.kaushal@kashvimlm.com' },
        },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'password', 'confirmPassword'],
        properties: {
          token: { type: 'string', description: 'Cryptographic 15-minute reset token received via email', example: '9a8b7c6d5e4f...' },
          password: { type: 'string', minLength: 8, format: 'password', example: 'NewStrongPassword123!' },
          confirmPassword: { type: 'string', minLength: 8, format: 'password', example: 'NewStrongPassword123!' },
        },
      },

      // 2. Distributor
      DistributorProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'dist-001' },
          memberId: { type: 'string', example: '88767139' },
          fullName: { type: 'string', example: 'Rahul Kaushal' },
          email: { type: 'string', example: 'r****l@kashvimlm.com' },
          phone: { type: 'string', example: '+91 98*** **210' },
          rank: { type: 'string', example: 'Diamond Director' },
          qualificationStatus: { type: 'string', enum: ['Active', 'Grace Period', 'Inactive'], example: 'Active' },
          sponsorId: { type: 'string', example: '88767139' },
          placementLeg: { type: 'string', enum: ['Left', 'Right'], example: 'Left' },
          leftVolumeBv: { type: 'number', example: 145000.0 },
          rightVolumeBv: { type: 'number', example: 128400.0 },
          personalSalesVolumeBv: { type: 'number', example: 450.0 },
          walletBalance: { type: 'number', example: 48250.0 },
          kycStatus: { type: 'string', enum: ['Verified', 'Pending', 'Rejected'], example: 'Verified' },
          bankAccountMasked: { type: 'string', example: 'XXXX-XXXX-4812' },
          panMasked: { type: 'string', example: 'ABCDE****F' },
        },
      },
      KycUpdateRequest: {
        type: 'object',
        required: ['panNumber', 'aadhaarNumber', 'bankAccount', 'ifscCode'],
        properties: {
          panNumber: { type: 'string', pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', example: 'ABCDE1234F' },
          aadhaarNumber: { type: 'string', minLength: 12, maxLength: 12, example: '123456789012' },
          bankName: { type: 'string', example: 'HDFC Bank' },
          bankAccount: { type: 'string', minLength: 9, maxLength: 18, example: '50100234567890' },
          ifscCode: { type: 'string', pattern: '^[A-Z]{4}0[A-Z0-9]{6}$', example: 'HDFC0001234' },
          accountHolderName: { type: 'string', example: 'Rahul Kaushal' },
        },
      },

      // 3. Enrollment
      EnrollmentRequest: {
        type: 'object',
        required: ['sponsorId', 'placementLeg', 'fullName', 'email', 'phone', 'password'],
        properties: {
          sponsorId: { type: 'string', example: '88767139' },
          placementLeg: { type: 'string', enum: ['Left', 'Right', 'Auto'], example: 'Auto' },
          fullName: { type: 'string', minLength: 3, example: 'Amit Kumar Verma' },
          email: { type: 'string', format: 'email', example: 'amit.verma@example.com' },
          phone: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', example: '+919812345678' },
          password: { type: 'string', minLength: 8, example: 'PartnerPass2026!' },
          parentDistributorId: { type: 'string', description: 'Optional explicit parent node in binary tree', example: '88767139-BC02' },
          welcomePackageSku: { type: 'string', example: 'KASH-HOZ-STARTER' },
        },
      },

      // 4. Products
      Product: {
        type: 'object',
        required: ['sku', 'name', 'category', 'distributorPrice', 'mrp', 'volumeBv', 'stockQuantity'],
        properties: {
          id: { type: 'string', example: 'prod-001' },
          sku: { type: 'string', example: 'KASH-HOZ-001' },
          name: { type: 'string', example: "Men's Combed Cotton Hosiery T-Shirt" },
          category: { type: 'string', enum: ['Clothes & Hosiery (Hozri)', 'Electronics', 'Ayurveda & Health', 'Home Essentials'], example: 'Clothes & Hosiery (Hozri)' },
          distributorPrice: { type: 'number', minimum: 0, example: 1299.0 },
          mrp: { type: 'number', minimum: 0, example: 1899.0 },
          volumeBv: { type: 'number', minimum: 0, example: 25.0 },
          stockQuantity: { type: 'integer', minimum: 0, example: 150 },
          status: { type: 'string', enum: ['In Stock', 'Low Stock', 'Out of Stock'], example: 'In Stock' },
          imageUrl: { type: 'string', format: 'uri', example: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600' },
          sizeSpec: { type: 'string', example: 'Size: M / L / XL / XXL' },
          shortDesc: { type: 'string', example: '100% fine combed cotton polo with pre-shrunk bio-wash fabric.' },
          benefits: { type: 'array', items: { type: 'string' }, example: ['Breathable', 'Colorfast', 'Soft touch'] },
        },
      },
      CreateProductRequest: {
        type: 'object',
        required: ['sku', 'name', 'category', 'distributorPrice', 'mrp', 'volumeBv', 'stockQuantity'],
        properties: {
          sku: { type: 'string', minLength: 3, example: 'KASH-ELEC-009' },
          name: { type: 'string', minLength: 3, example: 'Kashvi 5G Ultra Smartphone' },
          category: { type: 'string', example: 'Electronics' },
          distributorPrice: { type: 'number', minimum: 1, example: 14999.0 },
          mrp: { type: 'number', minimum: 1, example: 19999.0 },
          volumeBv: { type: 'number', minimum: 0, example: 250.0 },
          stockQuantity: { type: 'integer', minimum: 0, example: 75 },
          status: { type: 'string', default: 'In Stock', example: 'In Stock' },
          imageUrl: { type: 'string', example: '/assets/elec_phone.png' },
          sizeSpec: { type: 'string', example: '8GB RAM / 128GB Storage' },
          shortDesc: { type: 'string', example: 'Dual-SIM 5G smartphone with 108MP AI Camera.' },
          benefits: { type: 'array', items: { type: 'string' }, example: ['5000mAh Battery', 'Super AMOLED Display'] },
        },
      },

      // 5. Cart
      CartItem: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: 'prod-001' },
          sku: { type: 'string', example: 'KASH-HOZ-001' },
          name: { type: 'string', example: "Men's Combed Cotton Polo" },
          category: { type: 'string', example: 'Clothes & Hosiery (Hozri)' },
          imageUrl: { type: 'string', example: '/assets/hozri_tshirt.png' },
          mrp: { type: 'number', example: 1899.0 },
          distributorPrice: { type: 'number', example: 1299.0 },
          volumeBv: { type: 'number', example: 25.0 },
          quantity: { type: 'integer', minimum: 1, example: 2 },
          subtotal: { type: 'number', example: 2598.0 },
          totalBv: { type: 'number', example: 50.0 },
        },
      },
      CartResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/CartItem' } },
              totalItems: { type: 'integer', example: 2 },
              totalMrp: { type: 'number', example: 3798.0 },
              totalDistributorPrice: { type: 'number', example: 2598.0 },
              totalSavings: { type: 'number', example: 1200.0 },
              totalBv: { type: 'number', example: 50.0 },
              shippingFee: { type: 'number', example: 0.0 },
              grandTotal: { type: 'number', example: 2598.0 },
            },
          },
        },
      },
      AddCartItemRequest: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string', example: 'prod-001' },
          quantity: { type: 'integer', minimum: 1, maximum: 100, default: 1, example: 2 },
        },
      },

      // 6. Orders
      OrderCheckoutRequest: {
        type: 'object',
        required: ['items', 'shippingAddress'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', example: 'prod-001' },
                quantity: { type: 'integer', minimum: 1, example: 2 },
              },
            },
          },
          shippingAddress: { type: 'string', minLength: 10, example: 'Flat 402, Green Valley Towers, Sector 17-C, Chandigarh 160017' },
          paymentMethod: { type: 'string', enum: ['Wallet', 'Online Payment', 'UPI', 'NEFT'], default: 'Online Payment', example: 'Online Payment' },
        },
      },
      OrderResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ord-9041' },
          orderNumber: { type: 'string', example: 'KASH-ORD-2026-9041' },
          distributorId: { type: 'string', example: '88767139' },
          itemsCount: { type: 'integer', example: 2 },
          subtotal: { type: 'number', example: 2598.0 },
          totalBv: { type: 'number', example: 50.0 },
          shippingFee: { type: 'number', example: 0.0 },
          totalAmount: { type: 'number', example: 2598.0 },
          status: { type: 'string', enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'], example: 'Processing' },
          paymentStatus: { type: 'string', enum: ['Paid', 'Pending', 'Failed'], example: 'Paid' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // 7. BV Engine
      BvSummaryResponse: {
        type: 'object',
        properties: {
          memberId: { type: 'string', example: '88767139' },
          psvCurrentPeriod: { type: 'number', description: 'Personal Sales Volume', example: 120.0 },
          leftLegGbv: { type: 'number', description: 'Left Group Business Volume', example: 14520.0 },
          rightLegGbv: { type: 'number', description: 'Right Group Business Volume', example: 12800.0 },
          matchedBvCurrentCycle: { type: 'number', example: 12800.0 },
          leftCarryForward: { type: 'number', example: 1720.0 },
          rightCarryForward: { type: 'number', example: 0.0 },
          qualificationMet: { type: 'boolean', example: true },
        },
      },

      // 8. Commission
      CommissionCalculationResponse: {
        type: 'object',
        properties: {
          memberId: { type: 'string', example: '88767139' },
          cycleWeek: { type: 'integer', example: 38 },
          cycleYear: { type: 'integer', example: 2026 },
          matchedVolume: { type: 'number', example: 12800.0 },
          bonusPercentage: { type: 'number', example: 10.0 },
          binaryBonusEarnings: { type: 'number', example: 1280.0 },
          tdsDeduction: { type: 'number', description: '5% statutory Tax Deducted at Source', example: 64.0 },
          adminFeeDeduction: { type: 'number', description: '5% platform administration surcharge', example: 64.0 },
          netPayable: { type: 'number', example: 1152.0 },
        },
      },

      // 9. Wallet
      WalletBalanceResponse: {
        type: 'object',
        properties: {
          memberId: { type: 'string', example: '88767139' },
          balance: { type: 'number', example: 48250.0 },
          holdBalance: { type: 'number', example: 0.0 },
          lifetimeEarned: { type: 'number', example: 312000.0 },
          lifetimeWithdrawn: { type: 'number', example: 263750.0 },
          currency: { type: 'string', default: 'INR', example: 'INR' },
        },
      },
      WalletWithdrawRequest: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 500, description: 'Minimum withdrawal amount is ₹500', example: 10000.0 },
          remarks: { type: 'string', example: 'Weekly earnings withdrawal to verified HDFC account' },
        },
      },

      // 10. Payout
      PayoutRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'pay-001' },
          payoutNumber: { type: 'string', example: 'KV-PAY-2026-3801' },
          memberId: { type: 'string', example: '88767139' },
          grossAmount: { type: 'number', example: 25000.0 },
          tdsDeduction: { type: 'number', example: 1250.0 },
          netAmount: { type: 'number', example: 23750.0 },
          status: { type: 'string', enum: ['Pending', 'Processing', 'Settled', 'Rejected'], example: 'Settled' },
          utrNumber: { type: 'string', example: 'HDFC26092100481' },
          settledAt: { type: 'string', format: 'date-time' },
        },
      },

      // 11. Business Centers & Tree
      BusinessCenter: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'BC-01' },
          status: { type: 'string', example: 'Active' },
          leftBv: { type: 'number', example: 145000.0 },
          rightBv: { type: 'number', example: 128400.0 },
          carryLeft: { type: 'number', example: 16600.0 },
          carryRight: { type: 'number', example: 0.0 },
          activationDate: { type: 'string', format: 'date-time' },
        },
      },
      TreeNode: {
        type: 'object',
        properties: {
          memberId: { type: 'string', example: '88767139' },
          name: { type: 'string', example: 'Rahul Kaushal' },
          rank: { type: 'string', example: 'Diamond Director' },
          status: { type: 'string', example: 'Active' },
          leftLegCount: { type: 'integer', example: 420 },
          rightLegCount: { type: 'integer', example: 388 },
          leftBv: { type: 'number', example: 145000.0 },
          rightBv: { type: 'number', example: 128400.0 },
          leftChild: { type: 'object', nullable: true },
          rightChild: { type: 'object', nullable: true },
        },
      },

      // 12. Training
      TrainingModule: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'TRN-101' },
          title: { type: 'string', example: 'Dual-Leg Binary MLM Compensation Mastery' },
          durationMinutes: { type: 'integer', example: 45 },
          category: { type: 'string', example: 'Compensation Plan' },
          isCompleted: { type: 'boolean', example: true },
          badgeEarned: { type: 'string', example: 'Binary Specialist' },
        },
      },

      // 13. Website
      WebsiteInfoResponse: {
        type: 'object',
        properties: {
          companyName: { type: 'string', example: 'KashviMLM (Kashvi Vadic Lifestyle Pvt. Ltd.)' },
          tagline: { type: 'string', example: 'Empowering Independent Direct Sellers Across India' },
          founder: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Rahul Kaushal' },
              memberId: { type: 'string', example: '88767139' },
            },
          },
          corporateOffice: {
            type: 'object',
            properties: {
              street: { type: 'string', example: 'SCO 42-43, Sector 17-C' },
              city: { type: 'string', example: 'Chandigarh' },
              pincode: { type: 'string', example: '160017' },
            },
          },
          legal: {
            type: 'object',
            properties: {
              cin: { type: 'string', example: 'U52100CH2024PTC045812' },
              gst: { type: 'string', example: '04AABCK1234F1Z8' },
            },
          },
        },
      },

      // 14. News
      NewsArticle: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'news-001' },
          title: { type: 'string', example: 'New Launch: Kashvi 5G Flagship Smartphones & Ultra-Slim Laptops' },
          summary: { type: 'string', example: 'Next-generation electronics series now live on wholesale portal with 2X BV.' },
          content: { type: 'string', example: 'Full article text explaining products and BV rewards...' },
          category: { type: 'string', enum: ['Announcement', 'Product Launch', 'Contest', 'Leadership', 'Payout', 'General'], example: 'Product Launch' },
          isTicker: { type: 'boolean', example: true },
          imageUrl: { type: 'string', example: '/assets/dashboard/news_thumb_1.jpg' },
          publishedAt: { type: 'string', format: 'date-time' },
          author: { type: 'string', example: 'Corporate Communications' },
        },
      },

      // 15. Support
      SupportTicketRequest: {
        type: 'object',
        required: ['name', 'email', 'department', 'subject', 'description'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 80, example: 'Rahul Kaushal' },
          email: { type: 'string', format: 'email', example: 'rahul.kaushal@kashvimlm.com' },
          phone: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', example: '+91 70156 43886' },
          distributorId: { type: 'string', example: '88767139' },
          department: { type: 'string', example: 'BV Points & Weekly Payout Inquiry' },
          subject: { type: 'string', minLength: 5, maxLength: 150, example: 'Week 38 binary matching bonus confirmation' },
          description: { type: 'string', minLength: 10, maxLength: 2000, example: 'Requesting confirmation on Week 38 binary matching bonus payout dispatch.' },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium', example: 'Medium' },
        },
      },
      SupportTicket: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'tick-001' },
          ticketNumber: { type: 'string', example: 'KV-TKT-2026-9041' },
          name: { type: 'string', example: 'Rahul Kaushal' },
          email: { type: 'string', example: 'rahul.kaushal@kashvimlm.com' },
          phone: { type: 'string', example: '+91 70156 43886' },
          distributorId: { type: 'string', example: '88767139' },
          department: { type: 'string', example: 'BV Points & Weekly Payout Inquiry' },
          subject: { type: 'string', example: 'Week 38 binary matching bonus confirmation' },
          description: { type: 'string', example: 'Requesting confirmation on Week 38 binary matching bonus payout dispatch.' },
          status: { type: 'string', enum: ['Open', 'In Progress', 'Resolved', 'Closed'], example: 'Open' },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'], example: 'High' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      SupportMessage: {
        type: 'object',
        required: ['message'],
        properties: {
          id: { type: 'string', example: 'msg-001' },
          ticketId: { type: 'string', example: 'tick-001' },
          senderId: { type: 'string', example: 'usr-001' },
          message: { type: 'string', minLength: 1, maxLength: 2000, example: 'Payout reference UTR has been sent to your registered bank account.' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // 16. Notifications
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'notif-1' },
          title: { type: 'string', example: 'Weekly Binary Commission Credited' },
          message: { type: 'string', example: '₹22,400.00 matching bonus credited to your e-Wallet.' },
          type: {
            type: 'string',
            enum: ['COMMISSION', 'ORDER', 'PAYMENT', 'PAYOUT', 'ENROLLMENT', 'TRAINING', 'SYSTEM', 'SUPPORT', 'NEWS'],
            example: 'COMMISSION',
          },
          isRead: { type: 'boolean', example: false },
          actionUrl: { type: 'string', example: '/wallet' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // 17. Admin
      AdminOverviewResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          systemStatus: { type: 'string', example: 'OPERATIONAL' },
          timestamp: { type: 'string', format: 'date-time' },
          metrics: {
            type: 'object',
            properties: {
              totalDistributors: { type: 'integer', example: 52400 },
              activeDistributors: { type: 'integer', example: 48920 },
              totalOrders: { type: 'integer', example: 18450 },
              totalRevenue: { type: 'number', example: 28450000.0 },
              totalBvGenerated: { type: 'number', example: 389040.0 },
              pendingPayouts: { type: 'number', example: 1450000.0 },
              openSupportTickets: { type: 'integer', example: 14 },
            },
          },
        },
      },
      AuditLogEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'audit-1727000000-xyz' },
          actorId: { type: 'string', example: 'usr-admin-001' },
          action: {
            type: 'string',
            enum: [
              'LOGIN', 'LOGOUT', 'USER_CREATED', 'USER_UPDATED',
              'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED',
              'ORDER_CREATED', 'ORDER_CANCELLED', 'BV_CREDIT', 'BV_DEBIT',
              'COMMISSION_CREATED', 'COMMISSION_REVERSED', 'WALLET_ADJUSTMENT',
              'PAYOUT_APPROVED', 'PAYOUT_REJECTED', 'KYC_APPROVED', 'KYC_REJECTED', 'ADMIN_ACTION'
            ],
            example: 'PAYOUT_APPROVED',
          },
          entityType: { type: 'string', example: 'Payout' },
          entityId: { type: 'string', example: 'KV-PAY-2026-3801' },
          oldValue: { type: 'object', nullable: true },
          newValue: { type: 'object', nullable: true },
          ipAddress: { type: 'string', example: '192.168.1.100' },
          userAgent: { type: 'string', example: 'Mozilla/5.0...' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    // =========================================================================
    // 1. AUTHENTICATION
    // =========================================================================
    '/api/v1/auth/login': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Authenticate Distributor or Administrator',
        description: 'Authenticates credentials using Argon2id password verification. Enforces a 15-minute lockout after 5 consecutive failed login attempts.',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Authenticated successfully. Returns access token and sets HTTP-only refresh cookie.', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          400: { description: 'Validation failed (missing required username/password/sponsorId).', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
          401: { description: 'Invalid credentials or account inactive.', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } } },
          429: { description: 'Account or IP locked due to too many failed login attempts.', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } } },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Register New Independent Distributor Account',
        description: 'Registers a new distributor, validates sponsor identity, hashes password with Argon2id, and issues a unique Member ID.',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          201: { description: 'Distributor registered successfully.', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          400: { description: 'Validation error (password mismatch, weak password, or missing fields).', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
          409: { description: 'Email, phone, or username already registered.', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } } },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['1. Authentication'],
        summary: 'Get Authenticated Session Profile',
        description: 'Returns profile of current authenticated user from verified JWT access token.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Active authenticated session data.' },
          401: { description: 'Missing or expired JWT access token.' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Rotate Refresh Token & Issue New Access Token',
        description: 'Performs Refresh Token Rotation (RTR). Invalides old refresh token and generates a new pair. Detects token reuse/theft.',
        security: [{ CookieAuth: [] }],
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } },
        },
        responses: {
          200: { description: 'New JWT access token issued successfully.' },
          401: { description: 'Invalid, expired, or reused refresh token (token family revoked).' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Terminate Session & Invalidate Refresh Token Family',
        description: 'Revokes active refresh token family and clears HTTP-only security cookies.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Logged out successfully.' },
        },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Request Cryptographic 15-Minute Password Reset Token',
        description: 'Generates a secure 32-byte token with 15-minute expiration. Returns generic success to prevent account enumeration.',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } } },
        },
        responses: {
          200: { description: 'If account exists, password reset token generated.' },
          400: { description: 'Validation error in identifier format.' },
        },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Reset Password Using Single-Use Cryptographic Token',
        description: 'Verifies SHA-256 token, checks 15-minute expiry, hashes new password with Argon2id, and revokes all active sessions.',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } },
        },
        responses: {
          200: { description: 'Password reset successfully. Please log in with new password.' },
          400: { description: 'Token expired, invalid, or password requirements not satisfied.' },
        },
      },
    },

    // =========================================================================
    // 2. DISTRIBUTOR
    // =========================================================================
    '/api/v1/distributors/profile/{memberId}': {
      get: {
        tags: ['2. Distributor'],
        summary: 'Get Distributor Business Profile',
        description: 'Retrieves distributor details, binary volume, and rank. Enforces resource ownership; masks PII unless accessed by owner or administrator.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'memberId', in: 'path', required: false, description: 'Target Member ID (defaults to authenticated session)', schema: { type: 'string', default: '88767139' } },
        ],
        responses: {
          200: { description: 'Distributor profile retrieved.', content: { 'application/json': { schema: { $ref: '#/components/schemas/DistributorProfile' } } } },
          401: { description: 'Unauthorized.' },
          404: { description: 'Distributor not found.' },
        },
      },
    },
    '/api/v1/distributors/kyc-bank': {
      put: {
        tags: ['2. Distributor'],
        summary: 'Update KYC Documents & Bank Account Details',
        description: 'Saves PAN, Aadhaar, and bank account for automated NEFT payouts. Verifies resource ownership and marks KYC as pending administrator verification.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/KycUpdateRequest' } } },
        },
        responses: {
          200: { description: 'KYC and banking details submitted for verification.' },
          400: { description: 'Validation failed on PAN, IFSC, or account number.' },
          401: { description: 'Unauthorized.' },
        },
      },
    },
    '/api/v1/distributors/list': {
      get: {
        tags: ['2. Distributor'],
        summary: 'List All Registered Distributors (Admin Only)',
        description: 'Returns paginated directory of distributors with rank and status.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['Active', 'Grace Period', 'Inactive'] } },
        ],
        responses: {
          200: { description: 'Directory list.' },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
    },

    // =========================================================================
    // 3. ENROLLMENT
    // =========================================================================
    '/api/v1/enrollment/verify-sponsor/{sponsorId}': {
      get: {
        tags: ['3. Enrollment'],
        summary: 'Verify Sponsor Identity & Qualification Status',
        description: 'Validates that sponsor exists, holds active status, and is eligible to sponsor new partners into binary matrix.',
        security: [],
        parameters: [{ name: 'sponsorId', in: 'path', required: true, schema: { type: 'string', example: '88767139' } }],
        responses: {
          200: { description: 'Sponsor verified.', content: { 'application/json': { schema: { type: 'object', properties: { valid: { type: 'boolean' }, sponsorName: { type: 'string' }, rank: { type: 'string' } } } } } },
          404: { description: 'Sponsor ID not found in system.' },
        },
      },
    },
    '/api/v1/enrollment/enroll': {
      post: {
        tags: ['3. Enrollment'],
        summary: 'Enroll Brand Partner into Binary Downline Matrix',
        description: 'Registers new member, calculates placement into left or right subtree, and activates welcome enrollment volume.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EnrollmentRequest' } } },
        },
        responses: {
          201: { description: 'Partner enrolled successfully and placed into matrix.' },
          400: { description: 'Validation failed or sponsor not qualified.' },
        },
      },
    },
    '/api/v1/enrollment/submit': {
      post: {
        tags: ['3. Enrollment'],
        summary: 'Public Self-Enrollment Portal',
        description: 'Direct prospect enrollment through public referral registration links.',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EnrollmentRequest' } } },
        },
        responses: {
          201: { description: 'Enrollment completed.' },
        },
      },
    },

    // =========================================================================
    // 4. PRODUCTS
    // =========================================================================
    '/api/v1/products': {
      get: {
        tags: ['4. Products'],
        summary: 'Browse Wholesale Store Product Catalog',
        description: 'Returns available products with MRP, Distributor Wholesale Price (DP), and associated BV points.',
        security: [],
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Product list.', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Product' } } } } },
        },
      },
      post: {
        tags: ['4. Products'],
        summary: 'Publish New Product (ID Owner / Admin Only)',
        description: 'Adds item to catalog. Restricted strictly to ID Owner (88767139: Rahul Kaushal) or verified Admin.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProductRequest' } } },
        },
        responses: {
          201: { description: 'Product published to wholesale store.' },
          403: { description: 'Forbidden. Requires ID Owner (88767139) or Admin.' },
        },
      },
    },
    '/api/v1/products/{id}': {
      get: {
        tags: ['4. Products'],
        summary: 'Get Product Details by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Product details retrieved.' },
          404: { description: 'Product not found.' },
        },
      },
      put: {
        tags: ['4. Products'],
        summary: 'Update Product Pricing, BV, or Stock (ID Owner / Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProductRequest' } } } },
        responses: {
          200: { description: 'Product updated.' },
          403: { description: 'Forbidden.' },
        },
      },
      delete: {
        tags: ['4. Products'],
        summary: 'Delete Product from Catalog (ID Owner / Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Product removed.' },
        },
      },
    },
    '/api/v1/products/bulk-delete': {
      post: {
        tags: ['4. Products'],
        summary: 'Bulk Remove Products from Catalog (ID Owner / Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } } } },
        },
        responses: {
          200: { description: 'Products deleted.' },
        },
      },
    },
    '/api/v1/products/reset-zero': {
      post: {
        tags: ['4. Products'],
        summary: 'Reset Catalog to Empty State (ID Owner / Admin Only)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Catalog cleared.' } },
      },
    },
    '/api/v1/products/load-placeholders': {
      post: {
        tags: ['4. Products'],
        summary: 'Load Official Seed Catalog Placeholders (ID Owner / Admin Only)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Default demo inventory loaded.' } },
      },
    },

    // =========================================================================
    // 5. CART
    // =========================================================================
    '/api/v1/cart': {
      get: {
        tags: ['5. Cart'],
        summary: 'Retrieve Current Session Shopping Cart',
        description: 'Calculates live subtotal, total MRP savings, cumulative BV points, and complimentary shipping eligibility.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Active cart details.', content: { 'application/json': { schema: { $ref: '#/components/schemas/CartResponse' } } } },
        },
      },
    },
    '/api/v1/cart/items': {
      post: {
        tags: ['5. Cart'],
        summary: 'Add or Increment Item in Cart',
        description: 'Validates item existence and stock quantity before adding to cart.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AddCartItemRequest' } } },
        },
        responses: {
          200: { description: 'Item added to cart.', content: { 'application/json': { schema: { $ref: '#/components/schemas/CartResponse' } } } },
          400: { description: 'Requested quantity exceeds stock availability.' },
          404: { description: 'Product not found.' },
        },
      },
    },
    '/api/v1/cart/items/{productId}': {
      put: {
        tags: ['5. Cart'],
        summary: 'Update Quantity of Specific Cart Item',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['quantity'], properties: { quantity: { type: 'integer', minimum: 0 } } } } },
        },
        responses: {
          200: { description: 'Cart updated.' },
        },
      },
      delete: {
        tags: ['5. Cart'],
        summary: 'Remove Item from Cart',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Item removed.' },
        },
      },
    },
    '/api/v1/cart/clear': {
      post: {
        tags: ['5. Cart'],
        summary: 'Empty Entire Shopping Cart',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Cart emptied.' },
        },
      },
    },
    '/api/v1/cart/validate': {
      post: {
        tags: ['5. Cart'],
        summary: 'Pre-Checkout Cart Validation',
        description: 'Validates live inventory availability, calculates final totals, discounts, and BV points.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { $ref: '#/components/schemas/AddCartItemRequest' } } } } } },
        },
        responses: {
          200: { description: 'Cart validated successfully.' },
          400: { description: 'Stock validation or minimum order constraint failed.' },
        },
      },
    },

    // =========================================================================
    // 6. ORDERS
    // =========================================================================
    '/api/v1/orders/checkout': {
      post: {
        tags: ['6. Orders'],
        summary: 'Distributor Wholesale Cart Checkout',
        description: 'Creates order, debits inventory, and attributes Personal Sales Volume (PSV) to the authenticated distributor.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderCheckoutRequest' } } },
        },
        responses: {
          201: { description: 'Order created successfully.', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderResponse' } } } },
          400: { description: 'Insufficient stock or invalid shipping address.' },
          401: { description: 'Unauthorized.' },
        },
      },
    },
    '/api/v1/orders/my-orders': {
      get: {
        tags: ['6. Orders'],
        summary: 'Get Authenticated Distributor Orders',
        description: 'Retrieves purchase history. Strict ownership enforcement: never returns other users orders.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Order history list.' },
        },
      },
    },
    '/api/v1/orders/{orderNumber}': {
      get: {
        tags: ['6. Orders'],
        summary: 'Get Detailed Order Invoice',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'orderNumber', in: 'path', required: true, schema: { type: 'string', example: 'KASH-ORD-2026-9041' } }],
        responses: {
          200: { description: 'Order details and items.' },
          403: { description: 'Forbidden. User does not own this order.' },
          404: { description: 'Order number not found.' },
        },
      },
    },

    // =========================================================================
    // 7. BV ENGINE
    // =========================================================================
    '/api/v1/bv/summary/{memberId}': {
      get: {
        tags: ['7. BV'],
        summary: 'Get Business Volume (BV) Summary & Balance',
        description: 'Returns current cycle PSV, Left Leg GBV, Right Leg GBV, matched volume, and carry forwards.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: false, schema: { type: 'string', default: '88767139' } }],
        responses: {
          200: { description: 'BV status summary.', content: { 'application/json': { schema: { $ref: '#/components/schemas/BvSummaryResponse' } } } },
        },
      },
    },
    '/api/v1/bv/ledger/{memberId}': {
      get: {
        tags: ['7. BV'],
        summary: 'Get Detailed Business Volume Audit Ledger',
        description: 'Full historical audit trail of all credit, debit, and binary matching calculations.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: false, schema: { type: 'string' } }],
        responses: {
          200: { description: 'BV ledger records.' },
        },
      },
    },

    // =========================================================================
    // 8. COMMISSION
    // =========================================================================
    '/api/v1/commissions/calculate/{memberId}': {
      get: {
        tags: ['8. Commission'],
        summary: 'Simulate Live Binary Matching Bonus (10%)',
        description: 'Calculates 10% matching on lesser binary leg with statutory TDS and admin deductions.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: false, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Live bonus breakdown.', content: { 'application/json': { schema: { $ref: '#/components/schemas/CommissionCalculationResponse' } } } },
        },
      },
    },
    '/api/v1/commissions/history/{memberId}': {
      get: {
        tags: ['8. Commission'],
        summary: 'Get Weekly Commission Payout Statements',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: false, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Commission payment history.' },
        },
      },
    },

    // =========================================================================
    // 9. WALLET
    // =========================================================================
    '/api/v1/wallet/balance/{memberId}': {
      get: {
        tags: ['9. Wallet'],
        summary: 'Get e-Wallet Balance & Statistics',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: false, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Wallet balance.', content: { 'application/json': { schema: { $ref: '#/components/schemas/WalletBalanceResponse' } } } },
          403: { description: 'Forbidden. Ownership check failed.' },
        },
      },
    },
    '/api/v1/wallet/transactions/{memberId}': {
      get: {
        tags: ['9. Wallet'],
        summary: 'Get e-Wallet Transaction Ledger',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: false, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Transaction history with credits and debits.' },
        },
      },
    },
    '/api/v1/wallet/withdraw': {
      post: {
        tags: ['9. Wallet'],
        summary: 'Request Bank Payout Withdrawal from e-Wallet',
        description: 'Debits wallet balance and creates pending payout settlement request for verified bank account.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/WalletWithdrawRequest' } } },
        },
        responses: {
          200: { description: 'Withdrawal request queued.' },
          400: { description: 'Insufficient balance or below minimum threshold (₹500).' },
        },
      },
    },

    // =========================================================================
    // 10. PAYOUT
    // =========================================================================
    '/api/v1/payouts/my-payouts/{memberId}': {
      get: {
        tags: ['10. Payout'],
        summary: 'Get Bank Transfer Payout Records & UTR Numbers',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: false, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Payout records.' },
        },
      },
    },
    '/api/v1/payouts/generate-batch': {
      post: {
        tags: ['10. Payout'],
        summary: 'Generate Bank NEFT Payout Batch (Admin Only)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Payout settlement batch generated.' },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
    },

    // =========================================================================
    // 11. BUSINESS CENTERS
    // =========================================================================
    '/api/v1/distributors/business-centers/{memberId}': {
      get: {
        tags: ['11. Business Centers'],
        summary: 'Get Multi-Center Overview (BC-01, BC-02, BC-03)',
        description: 'Retrieves volume, qualification, and carry-forward balances across all business centers for the distributor.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: false, schema: { type: 'string', default: '88767139' } }],
        responses: {
          200: { description: 'Business Centers list.', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/BusinessCenter' } } } } },
        },
      },
    },
    '/api/v1/tree/structure/{memberId}': {
      get: {
        tags: ['11. Business Centers'],
        summary: 'Get Dual-Leg Binary Tree Downline Hierarchy',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'memberId', in: 'path', required: false, schema: { type: 'string', default: '88767139' } },
          { name: 'depth', in: 'query', schema: { type: 'integer', default: 3, maximum: 6 } },
        ],
        responses: {
          200: { description: 'Tree hierarchy structure.', content: { 'application/json': { schema: { $ref: '#/components/schemas/TreeNode' } } } },
        },
      },
    },
    '/api/v1/tree/node/{memberId}': {
      get: {
        tags: ['11. Business Centers'],
        summary: 'Get Specific Binary Node Telemetry',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Node details.' },
        },
      },
    },
    '/api/v1/tree/placement-suggest': {
      get: {
        tags: ['11. Business Centers'],
        summary: 'Get Algorithmically Optimized Binary Tree Placement Suggestion',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Suggested node and leg to balance volume.' },
        },
      },
    },
    '/api/v1/tree/move': {
      post: {
        tags: ['11. Business Centers'],
        summary: 'Admin Move Distributor (Prompt 16: Immutable Tree Audit Record)',
        description: 'Moves a distributor node to a new parent and position. Requires Reason, Old Parent, Old Position, New Parent, New Position, Admin ID, and Timestamp.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['memberId', 'reason', 'oldParent', 'oldPosition', 'newParent', 'newPosition'],
                properties: {
                  memberId: { type: 'string', example: 'KV-1007' },
                  reason: { type: 'string', example: 'Strategic branch rebalancing approved by compliance.' },
                  oldParent: { type: 'string', example: 'KV-1002' },
                  oldPosition: { type: 'string', example: 'RIGHT' },
                  newParent: { type: 'string', example: 'KV-1003' },
                  newPosition: { type: 'string', example: 'RIGHT' },
                  adminId: { type: 'string', example: 'usr-admin-001' },
                  timestamp: { type: 'string', example: '2026-09-24T12:00:00Z' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Distributor moved and immutable TREE_MEMBER_MOVED audit record created.' },
          400: { description: 'Validation failed: Reason, Old Parent, Old Position, New Parent, New Position, or Admin ID missing.' },
        },
      },
    },
    '/api/v1/tree/audit-logs': {
      get: {
        tags: ['11. Business Centers'],
        summary: 'Get MLM Tree Operation Audit Logs',
        description: 'Returns immutable compliance logs for SPONSOR_ASSIGNED, DISTRIBUTOR_CREATED, TREE_MEMBER_PLACED, TREE_MEMBER_MOVED, TREE_MEMBER_REMOVED, TREE_POSITION_CHANGED.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'memberId', in: 'query', schema: { type: 'string' }, description: 'Filter by distributor/member ID' },
          { name: 'event', in: 'query', schema: { type: 'string' }, description: 'Filter by tree event (e.g. TREE_MEMBER_MOVED)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: { description: 'List of tree audit records with actorId, memberId, sponsorId, placementParentId, position, oldValue, newValue, IP, userAgent, timestamp.' },
        },
      },
    },
    '/api/v1/admin/tree/move': {
      post: {
        tags: ['17. Admin'],
        summary: 'Admin Move Distributor in MLM Binary Tree',
        description: 'Requires Reason, Old Parent, Old Position, New Parent, New Position, Admin ID, Timestamp. Generates immutable audit record.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['memberId', 'reason', 'oldParent', 'oldPosition', 'newParent', 'newPosition'],
                properties: {
                  memberId: { type: 'string', example: 'KV-1007' },
                  reason: { type: 'string', example: 'Network restructuring' },
                  oldParent: { type: 'string', example: 'KV-1002' },
                  oldPosition: { type: 'string', example: 'RIGHT' },
                  newParent: { type: 'string', example: 'KV-1003' },
                  newPosition: { type: 'string', example: 'RIGHT' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Distributor moved and immutable audit record created.' },
        },
      },
    },

    // =========================================================================
    // 12. TRAINING
    // =========================================================================
    '/api/v1/training/modules': {
      get: {
        tags: ['12. Training'],
        summary: 'Get Distributor Academy Training Curriculum',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'List of training courses and completion status.', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TrainingModule' } } } } },
        },
      },
    },
    '/api/v1/training/complete': {
      post: {
        tags: ['12. Training'],
        summary: 'Mark Training Module as Completed',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['moduleCode'], properties: { moduleCode: { type: 'string', example: 'TRN-101' } } } } },
        },
        responses: {
          200: { description: 'Module recorded and certification badge credited.' },
        },
      },
    },

    // =========================================================================
    // 13. WEBSITE
    // =========================================================================
    '/api/v1/website/info': {
      get: {
        tags: ['13. Website'],
        summary: 'Get Official Corporate Profile & Compliance Details',
        security: [],
        responses: {
          200: { description: 'Corporate entity data, address, CIN, and GST.', content: { 'application/json': { schema: { $ref: '#/components/schemas/WebsiteInfoResponse' } } } },
        },
      },
    },
    '/api/v1/website/banners': {
      get: {
        tags: ['13. Website'],
        summary: 'Get Active Hero Banners, Promos, & Contests',
        security: [],
        responses: {
          200: { description: 'Promotional banners for homepage carousel.' },
        },
      },
    },
    '/api/v1/website/leadership': {
      get: {
        tags: ['13. Website'],
        summary: 'Get Executive Directors & Top Diamond Leaders',
        security: [],
        responses: {
          200: { description: 'Leadership profiles and testimonials.' },
        },
      },
    },

    // =========================================================================
    // 14. NEWS
    // =========================================================================
    '/api/v1/news': {
      get: {
        tags: ['14. News'],
        summary: 'Get Corporate News, Announcements, & Marquee Ticker',
        security: [],
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'tickerOnly', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: {
          200: { description: 'News articles list.', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/NewsArticle' } } } } },
        },
      },
      post: {
        tags: ['14. News'],
        summary: 'Publish Corporate News Announcement (Admin Only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['title', 'summary', 'content'], properties: { title: { type: 'string' }, summary: { type: 'string' }, content: { type: 'string' }, category: { type: 'string' }, isTicker: { type: 'boolean' } } } } },
        },
        responses: {
          201: { description: 'News article published.' },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
    },
    '/api/v1/news/{id}': {
      get: {
        tags: ['14. News'],
        summary: 'Get Full News Article by ID',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'News article details.', content: { 'application/json': { schema: { $ref: '#/components/schemas/NewsArticle' } } } },
          404: { description: 'News article not found.' },
        },
      },
      delete: {
        tags: ['14. News'],
        summary: 'Delete News Article (Admin Only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'News article deleted.' },
        },
      },
    },

    // =========================================================================
    // 15. SUPPORT
    // =========================================================================
    '/api/v1/support/tickets': {
      post: {
        tags: ['15. Support'],
        summary: 'Submit New Helpdesk Support Ticket',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SupportTicketRequest' } } },
        },
        responses: {
          201: { description: 'Ticket created.', content: { 'application/json': { schema: { $ref: '#/components/schemas/SupportTicket' } } } },
          400: { description: 'Validation error in ticket parameters.' },
        },
      },
      get: {
        tags: ['15. Support'],
        summary: 'Get Support Tickets with Filtering',
        description: 'Returns tickets submitted by authenticated distributor, or system tickets if admin.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Tickets list.' },
        },
      },
    },
    '/api/v1/support/tickets/{id}': {
      get: {
        tags: ['15. Support'],
        summary: 'Get Ticket Details & Threaded Conversation',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Ticket details and messages.' },
          403: { description: 'Forbidden. User does not own ticket.' },
          404: { description: 'Ticket not found.' },
        },
      },
    },
    '/api/v1/support/tickets/{id}/messages': {
      post: {
        tags: ['15. Support'],
        summary: 'Post Reply to Existing Ticket Thread',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string', minLength: 1 } } } } },
        },
        responses: {
          201: { description: 'Message posted to ticket thread.' },
        },
      },
      get: {
        tags: ['15. Support'],
        summary: 'Get All Threaded Messages for Ticket',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'List of messages.' },
        },
      },
    },
    '/api/v1/support/tickets/{id}/close': {
      post: {
        tags: ['15. Support'],
        summary: 'Close Ticket as Resolved',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Ticket closed.' },
        },
      },
    },
    '/api/v1/support/tickets/{id}/status': {
      patch: {
        tags: ['15. Support'],
        summary: 'Update Ticket Priority or Status',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['Open', 'In Progress', 'Resolved', 'Closed'] }, priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] } } } } },
        },
        responses: {
          200: { description: 'Ticket status updated.' },
        },
      },
    },

    // =========================================================================
    // 16. NOTIFICATIONS
    // =========================================================================
    '/api/v1/notifications': {
      get: {
        tags: ['16. Notifications'],
        summary: 'List In-App Notifications & Unread Badge Counter',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Notifications list.', content: { 'application/json': { schema: { type: 'object', properties: { count: { type: 'integer' }, unreadCount: { type: 'integer' }, data: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } } } },
        },
      },
    },
    '/api/v1/notifications/{id}/read': {
      patch: {
        tags: ['16. Notifications'],
        summary: 'Mark Individual Notification as Read',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Notification marked as read.' },
        },
      },
    },
    '/api/v1/notifications/read-all': {
      post: {
        tags: ['16. Notifications'],
        summary: 'Mark All User Notifications as Read',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'All notifications cleared to read status.' },
        },
      },
    },

    // =========================================================================
    // 17. ADMIN
    // =========================================================================
    '/api/v1/admin': {
      get: {
        tags: ['17. Admin'],
        summary: 'Executive Operational Overview & System Health',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'System health and overview metrics.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOverviewResponse' } } } },
        },
      },
    },
    '/api/v1/admin/metrics': {
      get: {
        tags: ['17. Admin'],
        summary: 'Live Executive Metrics (Distributors, BV, Revenue, Tickets)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Real-time metrics.' },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
    },
    '/api/v1/admin/audit-logs': {
      get: {
        tags: ['17. Admin'],
        summary: 'Retrieve Immutable Compliance Audit Trail',
        description: 'Returns tamper-proof system audit events. Filtering by actor, action, or date range.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Audit log entries.', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AuditLogEntry' } } } } },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
      delete: {
        tags: ['17. Admin'],
        summary: 'Anti-Tamper Guard: Deletion of Audit Logs is Strictly Forbidden',
        description: 'Always returns 403 Forbidden. Audit logs are immutable and cannot be deleted by anyone.',
        security: [{ BearerAuth: [] }],
        responses: {
          403: { description: 'Forbidden: Audit logs are immutable for compliance and legal accountability.' },
        },
      },
    },
    '/api/v1/admin/calculate-commissions': {
      post: {
        tags: ['17. Admin'],
        summary: 'Trigger Weekly Binary Commission Batch Calculation',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['cycleWeek', 'cycleYear'], properties: { cycleWeek: { type: 'integer', example: 38 }, cycleYear: { type: 'integer', example: 2026 } } } } },
        },
        responses: {
          200: { description: 'Commissions calculated and credited to member wallets.' },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
    },
    '/api/v1/admin/settle-payouts': {
      post: {
        tags: ['17. Admin'],
        summary: 'Execute NEFT Bank Payout Settlement Batch',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { type: 'object', properties: { batchCode: { type: 'string', example: 'BATCH-2026-W38' } } } } },
        },
        responses: {
          200: { description: 'Payouts settled and UTR acknowledgement recorded.' },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
    },
    '/api/v1/admin/distributors/{memberId}/status': {
      patch: {
        tags: ['17. Admin'],
        summary: 'Update Distributor Qualification Status',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'memberId', in: 'path', required: true, schema: { type: 'string', example: '88767139' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['Active', 'Grace Period', 'Inactive'] } } } } },
        },
        responses: {
          200: { description: 'Distributor status updated.' },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
    },
    '/api/v1/admin/support/tickets': {
      get: {
        tags: ['17. Admin'],
        summary: 'Admin Helpdesk Inquiries Queue',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'department', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'System-wide tickets with response telemetry.' },
          403: { description: 'Forbidden. Requires Admin role.' },
        },
      },
    },
    '/api/v1/admin/support/tickets/{id}': {
      patch: {
        tags: ['17. Admin'],
        summary: 'Admin Ticket Triage & Reassignment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, priority: { type: 'string' }, department: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Ticket triage saved.' },
        },
      },
    },
    '/api/v1/admin/support/tickets/{id}/reply': {
      post: {
        tags: ['17. Admin'],
        summary: 'Post Official Administrator Resolution Reply',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' }, status: { type: 'string', enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Resolved' } } } } },
        },
        responses: {
          200: { description: 'Resolution reply dispatched to distributor.' },
        },
      },
    },
  },
};

export function setupSwagger(app: Express): void {
  const swaggerUiOptions = {
    customSiteTitle: 'KashviMLM Enterprise API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'list',
    },
  };

  // Primary Swagger UI endpoint: GET /api/docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));

  // Raw JSON OpenAPI specification endpoint
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });
}
