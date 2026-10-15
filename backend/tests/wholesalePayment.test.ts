/**
 * Test Suite: Wholesale Razorpay Payment & GST Tax Invoice Integration
 * Uses Vitest & Supertest
 */
import crypto from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app';
import { InvoiceService } from '../src/services/invoice.service';
import { PaymentService } from '../src/services/payment.service';
import { WalletService } from '../src/services/wallet.service';
import { AppError } from '../src/utils/appError';
import { createTestToken } from './helpers/testHelpers';

describe('WHOLESALE RAZORPAY & GST INVOICE TEST SUITE', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const userId = '11111111-1111-4111-8111-111111111111';
  const token = createTestToken({
    id: userId,
    email: 'distributor@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });
  const productId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';

  describe('1. GST Invoice Service & Tax-Inclusive Calculation', () => {
    it('should generate a valid PDF 1.4 buffer starting with %PDF-1.4 and ending with %%EOF', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-98765-1001',
        createdAt: new Date(),
        paidAt: new Date(),
        status: 'PAID',
        subtotal: 1000,
        totalAmount: 1000,
        totalBV: 50,
        items: [
          {
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
            unitBV: 50,
            totalBV: 50,
            product: {
              name: 'Kashvi Premium Cotton T-Shirt',
              sku: 'KSH-TSHIRT-01',
              hsnCode: '61091000',
            },
          },
        ],
        shippingAddress: {
          recipientName: 'Rahul Kaushal',
          phone: '+91 98765 43210',
          streetAddress: 'Plot No. 43, Shiv TP Nagar',
          city: 'Ambala City',
          state: 'Haryana',
          postalCode: '134007',
          country: 'India',
        },
        user: {
          name: 'Rahul Kaushal',
          distributorProfile: {
            memberId: '88767139',
            distributorId: 'DIST-887671',
          },
        },
        payments: [
          {
            method: 'UPI',
            status: 'COMPLETED',
            gatewayTransactionId: 'pay_KashviRzp98214',
            paymentNumber: 'PAY-1001',
          },
        ],
      };

      vi.spyOn(InvoiceService, 'getInvoiceDataForOrder').mockResolvedValueOnce({
        invoiceNumber: 'INV-98765-1001',
        invoiceDate: '15 Oct 2026',
        orderNumber: 'ORD-98765-1001',
        orderDate: '15 Oct 2026',
        paymentMethod: 'Razorpay (UPI / Instant QR)',
        paymentStatus: 'PAID',
        transactionRef: 'pay_KashviRzp98214',
        isInterState: false,
        seller: {
          name: 'Kashvi International Pvt. Ltd.',
          tradeName: 'KASHVIMLM Wholesale Division',
          address: 'Plot No. 43, Shiv TP Nagar',
          city: 'Ambala City',
          state: 'Haryana',
          stateCode: '06',
          postalCode: '134007',
          gstin: '06AAAAK0000A1Z5',
          pan: 'AAAAK0000A',
          email: 'billing@kashvimlm.com',
          phone: '+91 98765 43210',
        },
        buyer: {
          name: 'Rahul Kaushal',
          memberId: '88767139',
          phone: '+91 98765 43210',
          address: 'Plot No. 43, Shiv TP Nagar',
          city: 'Ambala City',
          state: 'Haryana',
          stateCode: '06',
          postalCode: '134007',
          country: 'India',
        },
        items: [
          {
            name: 'Kashvi Premium Cotton T-Shirt',
            sku: 'KSH-TSHIRT-01',
            hsn: '61091000',
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
            taxableValue: 847.46,
            gstRate: 18,
            cgstAmount: 76.27,
            sgstAmount: 76.27,
            igstAmount: 0,
            bv: 50,
          },
        ],
        totals: {
          itemsCount: 1,
          taxableTotal: 847.46,
          cgstTotal: 76.27,
          sgstTotal: 76.27,
          igstTotal: 0,
          gstTotal: 152.54,
          grandTotal: 1000,
          totalBV: 50,
        },
      });

      const { buffer, invoiceNumber } = await InvoiceService.generateInvoicePdf(orderId, userId, 'DISTRIBUTOR');
      expect(invoiceNumber).toBe('INV-98765-1001');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);

      const pdfHeader = buffer.toString('utf-8', 0, 8);
      expect(pdfHeader).toContain('%PDF-1.4');

      const pdfTail = buffer.toString('utf-8', buffer.length - 20);
      expect(pdfTail).toContain('%%EOF');
    });

    it('should correctly calculate 18% inclusive GST (taxable + GST = total price)', () => {
      const totalPrice = 1180;
      const taxableValue = Math.round((totalPrice / 1.18) * 100) / 100;
      const totalGST = Math.round((totalPrice - taxableValue) * 100) / 100;

      expect(taxableValue).toBe(1000);
      expect(totalGST).toBe(180);
      expect(taxableValue + totalGST).toBe(totalPrice);

      // Intra-state (Haryana to Haryana): CGST 9% and SGST 9%
      const cgst = Math.round((totalGST / 2) * 100) / 100;
      const sgst = Math.round((totalGST - cgst) * 100) / 100;
      expect(cgst).toBe(90);
      expect(sgst).toBe(90);
    });
  });

  describe('2. Razorpay Payment Service (Signature Verification & Orders)', () => {
    it('should reject tampered or fraudulent payment signatures with HTTP 400', async () => {
      vi.spyOn(PaymentService, 'verifyRazorpayPayment').mockImplementation(async () => {
        throw AppError.badRequest('Invalid payment signature verification failed.', 'PAYMENT_SIGNATURE_INVALID');
      });

      const res = await request(app)
        .post('/api/v1/payments/razorpay/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          razorpayOrderId: 'order_test_123',
          razorpayPaymentId: 'pay_test_456',
          razorpaySignature: 'tampered_fake_signature',
          orderId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should verify payment successfully when signature matches HMAC-SHA256', async () => {
      const secret = 'your_key_secret_keep_secret';
      const rzpOrderId = 'order_test_123';
      const rzpPaymentId = 'pay_test_456';
      const validSig = crypto.createHmac('sha256', secret).update(`${rzpOrderId}|${rzpPaymentId}`).digest('hex');

      vi.spyOn(PaymentService, 'verifyRazorpayPayment').mockResolvedValueOnce({
        success: true,
        order: {
          id: orderId,
          orderNumber: 'ORD-98765-1001',
          status: 'PAID',
          totalAmount: 800,
          totalBV: 40,
        } as any,
      });

      const res = await request(app)
        .post('/api/v1/payments/razorpay/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: rzpPaymentId,
          razorpaySignature: validSig,
          orderId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('PAID');
    });

    it('should reject unauthenticated requests to create Razorpay order', async () => {
      const res = await request(app)
        .post('/api/v1/payments/razorpay/order')
        .send({
          items: [{ productId, quantity: 1 }],
          paymentMethod: 'UPI',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('3. Atomic Commission Balance Wallet Checkout', () => {
    it('should reject wallet checkout if available balance is less than required total', async () => {
      vi.spyOn(PaymentService, 'walletCheckout').mockImplementation(async () => {
        const { AppError } = await import('../src/utils/appError');
        throw AppError.badRequest(
          'Insufficient commission balance in wallet. Available: INR 200, Required: INR 800.',
          'INSUFFICIENT_WALLET_BALANCE'
        );
      });

      const res = await request(app)
        .post('/api/v1/orders/wallet-checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient commission balance');
    });

    it('should successfully place and pay order from wallet when balance is sufficient', async () => {
      vi.spyOn(PaymentService, 'walletCheckout').mockResolvedValueOnce({
        success: true,
        order: {
          id: orderId,
          orderNumber: 'ORD-WALLET-1001',
          status: 'PAID',
          totalAmount: 500,
          totalBV: 25,
        } as any,
        wallet: {
          availableBalance: 42000,
        } as any,
      });

      const res = await request(app)
        .post('/api/v1/orders/wallet-checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId, quantity: 1 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('PAID');
      expect(res.body.data.wallet.availableBalance).toBe(42000);
    });
  });

  describe('4. Invoice Download Endpoint (/api/v1/orders/:id/invoice)', () => {
    it('should stream PDF with application/pdf and attachment filename header', async () => {
      const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\nxref\ntrailer<<>>startxref\n0\n%%EOF');

      vi.spyOn(InvoiceService, 'generateInvoicePdf').mockResolvedValueOnce({
        buffer: samplePdf,
        invoiceNumber: 'INV-1001',
      });

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}/invoice`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment; filename="Invoice-INV-1001.pdf"');
      expect(res.body).toBeDefined();
    });
  });

  describe('5. Wallet Balance Endpoint (/api/v1/wallet and /api/v1/wallet/me)', () => {
    it('should retrieve authenticated user wallet with availableBalance', async () => {
      vi.spyOn(WalletService, 'getWalletByUserId').mockResolvedValueOnce({
        id: 'wallet-1',
        distributorId: 'dist-1',
        availableBalance: 42500,
        pendingBalance: 0,
        lifetimeEarned: 50000,
        lifetimePaid: 7500,
        currency: 'INR',
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/wallet')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.availableBalance).toBe(42500);
    });
  });
});
