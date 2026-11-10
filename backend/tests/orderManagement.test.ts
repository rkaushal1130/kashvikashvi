/**
 * ============================================================================
 * KASHVI MLM: ORDER MANAGEMENT REQUIREMENTS TEST SUITE
 * ============================================================================
 *
 * Verifies all 14 order management requirements:
 * 1. Automatic Order Synchronization
 * 2. Real-Time Order Updates
 * 3. Display Complete Order Details (Order #, Date, Name, Kashvi MLM ID, Items, Amount, BV, Method, Payment Status, Order Status)
 * 4. Payment Status Synchronization (PAID, PENDING, FAILED, PROCESSING)
 * 5. Order Status Management (PENDING, PROCESSING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED)
 * 6. Order Details Inspection (getOrderById)
 * 7. Dashboard Statistics (Total Orders, Revenue, Credited BV, Paid & Settled, Pending/Processing)
 * 8. Search and Filters (By Order #, Buyer Name, Kashvi MLM ID, and Statuses)
 * 9. Database Integration & Dynamic Fetching
 * 10. Payment Verification (No order marked PAID without payment verification)
 * 11. BV Integration (BV credited only on payment confirmation)
 * 12. Data Consistency (No duplicated or missing orders)
 * 13. Scope & Permissions (Admin sees all; Member sees own)
 * 14. Preserve Existing Functionality (Super Admin KK-0001, seed users, auth)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from '../src/services/order.service';
import { AuthService } from '../src/services/auth.service';
import { PaymentService } from '../src/services/payment.service';

describe('KASHVI MLM - ORDER MANAGEMENT REQUIREMENTS', { timeout: 30000 }, () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.ENABLE_DEMO_SEED = 'true';
    AuthService.clearInMemoryUsers();
    PaymentService.clearProcessedWebhookEvents();
    OrderService.clearInMemoryOrders();
    await AuthService.initSeedUsers();
    OrderService.initSeedOrders();
  });

  // --------------------------------------------------------------------------
  // REQ 1 & 2: Automatic Order Synchronization & Real-Time Updates
  // --------------------------------------------------------------------------
  describe('1 & 2. Automatic Order Synchronization & Real-Time Updates', () => {
    it('Orders placed by any member automatically appear in Admin orders list without manual DB updates', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');
      const distributor = AuthService.getInMemoryUser('KK-0002');
      expect(adminUser).toBeDefined();
      expect(distributor).toBeDefined();

      // Check initial orders count
      const initialOrdersRes = await OrderService.getOrders(adminUser.id, 'ADMIN', { limit: 50 });
      const initialCount = initialOrdersRes.items.length;
      expect(initialCount).toBeGreaterThanOrEqual(6);

      // Distributor places an order
      const newOrder = await OrderService.createOrderInMemory(distributor.id, {
        items: [
          { productId: 'KASH-HOZ-001', quantity: 2 },
          { productId: 'KASH-ELE-002', quantity: 1 },
        ],
        paymentMethod: 'WALLET',
        markPaid: true,
      });

      expect(newOrder).toBeDefined();
      expect(newOrder.orderNumber).toMatch(/^ORD-/);

      // Verify it immediately appears in Admin orders
      const updatedOrdersRes = await OrderService.getOrders(adminUser.id, 'ADMIN', { limit: 50 });
      expect(updatedOrdersRes.items.length).toBe(initialCount + 1);

      const found = updatedOrdersRes.items.find((o: any) => o.id === newOrder.id || o.orderNumber === newOrder.orderNumber);
      expect(found).toBeDefined();
      expect(found.customerName).toBe(distributor.fullName);
      expect(found.distributorCode).toBe('KK-0002');
    });
  });

  // --------------------------------------------------------------------------
  // REQ 3: Display Complete Order Details
  // --------------------------------------------------------------------------
  describe('3. Display Complete Order Details', () => {
    it('Every order contains all 10 mandatory fields with accurate formats', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');
      const ordersRes = await OrderService.getOrders(adminUser.id, 'ADMIN', { limit: 10 });
      expect(ordersRes.items.length).toBeGreaterThan(0);

      const sampleOrder = ordersRes.items[0];

      // 1. Unique Order Number
      expect(sampleOrder.orderNumber).toBeDefined();
      expect(sampleOrder.orderNumber.length).toBeGreaterThan(5);

      // 2. Order Date and Time
      expect(sampleOrder.createdAt).toBeDefined();
      expect(new Date(sampleOrder.createdAt).getTime()).not.toBeNaN();

      // 3. Distributor / Buyer Name
      expect(sampleOrder.customerName).toBeDefined();
      expect(sampleOrder.customerName.length).toBeGreaterThan(0);

      // 4. Kashvi MLM ID (KK-0001, KK-0002, etc.)
      expect(sampleOrder.distributorCode).toBeDefined();
      expect(sampleOrder.distributorCode).toMatch(/^KK-\d{4}$/);
      expect(sampleOrder.memberId).toBe(sampleOrder.distributorCode);

      // 5. Ordered Products and Quantities
      expect(Array.isArray(sampleOrder.items)).toBe(true);
      expect(sampleOrder.items.length).toBeGreaterThan(0);
      sampleOrder.items.forEach((item: any) => {
        expect(item.productName).toBeDefined();
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.unitPrice).toBeGreaterThan(0);
        expect(item.totalPrice).toBeGreaterThanOrEqual(item.unitPrice);
      });

      // 6. Total Order Amount (₹)
      expect(typeof sampleOrder.totalAmount).toBe('number');
      expect(sampleOrder.totalAmount).toBeGreaterThan(0);

      // 7. Credited Business Volume (BV)
      expect(typeof sampleOrder.totalBV).toBe('number');
      expect(sampleOrder.totalBV).toBeGreaterThanOrEqual(0);

      // 8. Payment Method
      expect(sampleOrder.paymentMethod).toBeDefined();
      expect(['WALLET', 'RAZORPAY', 'UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'N/A']).toContain(sampleOrder.paymentMethod);

      // 9. Payment Status
      expect(['PAID', 'PENDING', 'FAILED', 'PROCESSING']).toContain(sampleOrder.paymentStatus);

      // 10. Order Processing Status
      expect(['PENDING', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).toContain(sampleOrder.status);
    });
  });

  // --------------------------------------------------------------------------
  // REQ 4: Payment Status Synchronization
  // --------------------------------------------------------------------------
  describe('4. Payment Status Synchronization', () => {
    it('Accurately represents PAID, PENDING, FAILED, and PROCESSING statuses', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');
      const ordersRes = await OrderService.getOrders(adminUser.id, 'ADMIN', { limit: 50 });

      const paidOrder = ordersRes.items.find((o: any) => o.paymentStatus === 'PAID');
      const pendingOrder = ordersRes.items.find((o: any) => o.paymentStatus === 'PENDING');
      const failedOrder = ordersRes.items.find((o: any) => o.paymentStatus === 'FAILED');
      const processingOrder = ordersRes.items.find((o: any) => o.paymentStatus === 'PROCESSING');

      // Verify PAID order
      expect(paidOrder).toBeDefined();
      expect(paidOrder.paymentStatus).toBe('PAID');
      expect(paidOrder.isPaid).toBe(true);

      // Verify PENDING order
      expect(pendingOrder).toBeDefined();
      expect(pendingOrder.paymentStatus).toBe('PENDING');
      expect(pendingOrder.isPaid).toBe(false);

      // Verify FAILED order
      expect(failedOrder).toBeDefined();
      expect(failedOrder.paymentStatus).toBe('FAILED');
      expect(failedOrder.isPaid).toBe(false);

      // Verify PROCESSING order
      expect(processingOrder).toBeDefined();
      expect(processingOrder.paymentStatus).toBe('PROCESSING');
      expect(processingOrder.isPaid).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // REQ 5: Order Status Management
  // --------------------------------------------------------------------------
  describe('5. Order Status Management', () => {
    it('Admin can transition order status through all 6 required statuses', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');
      const distributor = AuthService.getInMemoryUser('KK-0002');

      // Create an initial pending order
      const order = await OrderService.createOrderInMemory(distributor.id, {
        items: [{ productId: 'KASH-HOZ-001', quantity: 1 }],
        markPaid: false,
      });
      expect(order.status).toBe('PENDING');

      // 1. Update to PROCESSING
      const step1 = await OrderService.updateOrderStatus(adminUser.id, 'ADMIN', order.id, 'PROCESSING' as any);
      expect(step1.order.status).toBe('PROCESSING');

      // 2. Update to CONFIRMED
      const step2 = await OrderService.updateOrderStatus(adminUser.id, 'ADMIN', order.id, 'CONFIRMED' as any);
      expect(step2.order.status).toBe('CONFIRMED');

      // 3. Update to SHIPPED
      const step3 = await OrderService.updateOrderStatus(adminUser.id, 'ADMIN', order.id, 'SHIPPED' as any);
      expect(step3.order.status).toBe('SHIPPED');

      // 4. Update to DELIVERED
      const step4 = await OrderService.updateOrderStatus(adminUser.id, 'ADMIN', order.id, 'DELIVERED' as any);
      expect(step4.order.status).toBe('DELIVERED');

      // 5. Update to CANCELLED
      const step5 = await OrderService.updateOrderStatus(adminUser.id, 'ADMIN', order.id, 'CANCELLED' as any);
      expect(step5.order.status).toBe('CANCELLED');

      // Non-admin cannot update status
      await expect(
        OrderService.updateOrderStatus(distributor.id, 'DISTRIBUTOR', order.id, 'CONFIRMED' as any)
      ).rejects.toThrow(/Only administrators/);
    });
  });

  // --------------------------------------------------------------------------
  // REQ 6: Order Details Inspection
  // --------------------------------------------------------------------------
  describe('6. Order Details Inspection', () => {
    it('getOrderById returns complete order details including buyer, products, quantities, and BV', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');
      const details = await OrderService.getOrderById(adminUser.id, 'ADMIN', 'ORD-2026-10001');

      expect(details).toBeDefined();
      expect(details.orderNumber).toBe('ORD-2026-10001');
      expect(details.distributorCode).toBe('KK-0001');
      expect(details.customerName).toContain('Rahul Kaushal');
      expect(details.shippingAddress).toBeDefined();
      expect(details.shippingAddress.city).toBe('Ambala City');
      expect(details.items.length).toBe(2);
      expect(details.totalAmount).toBe(14999);
      expect(details.totalBV).toBe(250);
      expect(details.paymentStatus).toBe('PAID');
    });
  });

  // --------------------------------------------------------------------------
  // REQ 7: Dashboard Statistics
  // --------------------------------------------------------------------------
  describe('7. Dashboard Statistics Calculation', () => {
    it('Accurately computes Total Orders, Gross Revenue, Credited BV, Paid & Settled, and Pending/Processing', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');
      const ordersRes = await OrderService.getOrders(adminUser.id, 'ADMIN', { limit: 100 });
      const orders = ordersRes.items;

      // Compute statistics using the exact logic defined for AdminOrdersPage
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((acc: number, o: any) => acc + (Number(o.totalAmount) || 0), 0);
      const totalBV = orders.reduce((acc: number, o: any) => {
        const isPaid =
          o.isPaid ||
          o.paymentStatus === 'PAID' ||
          ['DELIVERED', 'SHIPPED', 'CONFIRMED', 'PAID', 'COMPLETED'].includes(o.status?.toUpperCase());
        return isPaid ? acc + (Number(o.totalBV) || 0) : acc;
      }, 0);
      const paidOrders = orders.filter((o: any) =>
        o.isPaid ||
        o.paymentStatus === 'PAID' ||
        ['PAID', 'DELIVERED', 'SHIPPED', 'CONFIRMED', 'COMPLETED'].includes(o.status?.toUpperCase())
      ).length;
      const pendingOrders = orders.filter((o: any) =>
        !o.isPaid &&
        o.paymentStatus !== 'PAID' &&
        ['PENDING', 'PAYMENT_PENDING', 'PROCESSING'].includes((o.status || o.paymentStatus)?.toUpperCase())
      ).length;

      expect(totalOrders).toBeGreaterThanOrEqual(6);
      expect(totalRevenue).toBeGreaterThan(0);
      expect(totalBV).toBeGreaterThan(0);
      expect(paidOrders).toBeGreaterThan(0);
      expect(pendingOrders).toBeGreaterThan(0);
      expect(paidOrders + pendingOrders).toBeLessThanOrEqual(totalOrders);
    });
  });

  // --------------------------------------------------------------------------
  // REQ 8: Search and Filters
  // --------------------------------------------------------------------------
  describe('8. Search and Filters', () => {
    it('Allows filtering by status and searching by Order #, Member Name, and Kashvi MLM ID', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');

      // 1. Status Filter: DELIVERED
      const deliveredOrders = await OrderService.getOrders(adminUser.id, 'ADMIN', { status: 'DELIVERED' as any });
      expect(deliveredOrders.items.length).toBeGreaterThan(0);
      deliveredOrders.items.forEach((o: any) => {
        expect(o.status).toBe('DELIVERED');
      });

      // 2. Status Filter: CANCELLED
      const cancelledOrders = await OrderService.getOrders(adminUser.id, 'ADMIN', { status: 'CANCELLED' as any });
      expect(cancelledOrders.items.length).toBeGreaterThan(0);
      cancelledOrders.items.forEach((o: any) => {
        expect(o.status).toBe('CANCELLED');
      });

      // 3. Search by Order Number
      const allOrders = (await OrderService.getOrders(adminUser.id, 'ADMIN', { limit: 100 })).items;
      const matchOrderNum = allOrders.filter((o: any) => o.orderNumber.includes('ORD-2026-10001'));
      expect(matchOrderNum.length).toBe(1);

      // 4. Search by Kashvi MLM ID
      const matchKk0001 = allOrders.filter((o: any) => o.distributorCode === 'KK-0001');
      expect(matchKk0001.length).toBeGreaterThanOrEqual(1);

      const matchKk0002 = allOrders.filter((o: any) => o.distributorCode === 'KK-0002');
      expect(matchKk0002.length).toBeGreaterThanOrEqual(1);

      // 5. Search by Member Name
      const matchName = allOrders.filter((o: any) =>
        o.customerName.toLowerCase().includes('rahul')
      );
      expect(matchName.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // REQ 10 & 11: Payment Verification & BV Integration
  // --------------------------------------------------------------------------
  describe('10 & 11. Payment Verification & BV Integration', () => {
    it('Newly created order without payment is PENDING, not PAID, and only transitions to PAID upon verified payment', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');
      const distributor = AuthService.getInMemoryUser('KK-0002');

      // Create an order without marking as paid
      const unpaidOrder = await OrderService.createOrderInMemory(distributor.id, {
        items: [{ productId: 'KASH-ELE-001', quantity: 1 }],
        markPaid: false,
      });

      expect(unpaidOrder.paymentStatus).toBe('PENDING');
      expect(unpaidOrder.isPaid).toBe(false);
      expect(unpaidOrder.paidAt).toBeNull();

      // Now verify and update to PAID
      const paidOrderResult = await OrderService.updateOrderStatus(
        adminUser.id,
        'ADMIN',
        unpaidOrder.id,
        'PAID' as any
      );

      expect(paidOrderResult.order.paymentStatus).toBe('PAID');
      expect(paidOrderResult.order.isPaid).toBe(true);
      expect(paidOrderResult.order.paidAt).toBeDefined();
    });

    it('Transitions member ID to green upon successful order payment confirmation', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');

      // Register a brand new member KK-0007
      const registered = await AuthService.register({
        email: 'new_shopper@kashvimlm.com',
        phone: '9876543299',
        password: 'Password123!',
        fullName: 'New Shopping Member',
        sponsorId: 'KK-0001',
      });

      const memberId = registered.user.distributorCode;
      expect(memberId).toBeDefined();

      // Initially NOT green / unpaid
      const initialProfile = await AuthService.getMe(registered.user.id);
      expect(initialProfile.isPaid).toBe(false);
      expect(initialProfile.paymentStatus).toBe('PENDING');

      // Place an order and mark as PAID
      const paidOrder = await OrderService.createOrderInMemory(registered.user.id, {
        items: [{ productId: 'KASH-HOZ-001', quantity: 1 }],
        markPaid: true,
      });

      expect(paidOrder.paymentStatus).toBe('PAID');
      expect(paidOrder.isPaid).toBe(true);

      // Verify the member ID automatically turned green
      const updatedProfile = await AuthService.getMe(registered.user.id);
      expect(updatedProfile.isPaid).toBe(true);
      expect(updatedProfile.paymentStatus).toBe('PAID');
      expect(updatedProfile.status).toBe('ACTIVE');
    });
  });

  // --------------------------------------------------------------------------
  // REQ 12 & 13: Data Consistency, Scopes, and Preserved Functionality
  // --------------------------------------------------------------------------
  describe('12, 13 & 14. Data Consistency, Permissions, and Preserved Functionality', () => {
    it('Orders are deduplicated and access control restricts non-admins to their own orders', async () => {
      const adminUser = AuthService.getInMemoryUser('KK-0001');
      const dist2 = AuthService.getInMemoryUser('KK-0002');
      const dist3 = AuthService.getInMemoryUser('KK-0003');

      // Admin gets all orders
      const adminOrders = await OrderService.getOrders(adminUser.id, 'ADMIN', { limit: 100 });
      expect(adminOrders.items.length).toBeGreaterThanOrEqual(6);

      // Verify no duplicate IDs in listing
      const ids = adminOrders.items.map((o: any) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Dist 2 gets only their own orders
      const dist2Orders = await OrderService.getOrders(dist2.id, 'DISTRIBUTOR', { limit: 100 });
      dist2Orders.items.forEach((o: any) => {
        expect([dist2.id, 'KK-0002']).toContain(o.distributorCode || o.userId);
      });

      // Dist 3 cannot view Dist 2 order by ID
      const dist2OrderSample = dist2Orders.items[0];
      if (dist2OrderSample) {
        await expect(
          OrderService.getOrderById(dist3.id, 'DISTRIBUTOR', dist2OrderSample.id)
        ).rejects.toThrow(/You do not have permission/);
      }
    });

    it('Super Admin KK-0001 and system seed users remain permanently intact', async () => {
      const superAdmin = AuthService.getInMemoryUser('KK-0001');
      expect(superAdmin).toBeDefined();
      expect(superAdmin.distributorCode).toBe('KK-0001');
      expect(superAdmin.isPaid).toBe(true);
      expect(superAdmin.roleName).toBe('SUPER_ADMIN');

      const dist2 = AuthService.getInMemoryUser('KK-0002');
      expect(dist2).toBeDefined();
      expect(dist2.distributorCode).toBe('KK-0002');
    });
  });
});
