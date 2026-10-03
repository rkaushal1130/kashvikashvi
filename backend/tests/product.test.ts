/**
 * Test Suite: Product Catalog Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - Create product (Admin only, validation)
 * - Update product (Admin only)
 * - Delete product (Admin only, soft deletion)
 * - Search products (Keyword search)
 * - Filtering products (Category, price range, BV, stock status, sorting)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { ProductService, slugify } from '../src/services/product.service';
import {
  createProductSchema,
  productQuerySchema,
  productSortEnum,
  productStatusEnum,
} from '../src/validators/product.validators';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('PRODUCT MODULE AUTOMATED TESTS (Supertest + Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const adminToken = createAdminToken();
  const distributorToken = createTestToken();
  const productId = '11111111-2222-3333-4444-555555555555';

  describe('1. Create Product (POST /api/v1/products)', () => {
    it('should successfully create a new product with Admin credentials', async () => {
      const newProduct = {
        id: productId,
        sku: 'CLO-COMP-001',
        name: 'ActiveFit Graduated Compression Hosiery Pro',
        slug: 'activefit-graduated-compression-hosiery-pro',
        categoryId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        wholesalePrice: 29.99,
        mrp: 49.99,
        bv: 25.0,
        stock: 500,
        status: 'ACTIVE',
        isFeatured: true,
      };

      vi.spyOn(ProductService, 'createProduct').mockResolvedValue(newProduct as any);

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: 'CLO-COMP-001',
          name: 'ActiveFit Graduated Compression Hosiery Pro',
          categoryId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
          wholesalePrice: 29.99,
          mrp: 49.99,
          bv: 25.0,
          stock: 500,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe('CLO-COMP-001');
      expect(res.body.data.wholesalePrice).toBe(29.99);
      expect(res.body.data.bv).toBe(25.0);
    });

    it('should reject product creation when unauthorized (Distributor role)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({
          sku: 'CLO-COMP-002',
          name: 'Unauthorized Product',
          categoryId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
          wholesalePrice: 19.99,
          mrp: 29.99,
          bv: 15.0,
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should reject product creation when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .send({
          sku: 'CLO-COMP-003',
          name: 'No Auth Product',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Update Product (PATCH /api/v1/products/:id)', () => {
    it('should successfully update product pricing and stock with Admin credentials', async () => {
      const updated = {
        id: productId,
        sku: 'CLO-COMP-001',
        name: 'ActiveFit Graduated Compression Hosiery Pro Updated',
        wholesalePrice: 34.99,
        stock: 450,
      };

      vi.spyOn(ProductService, 'updateProduct').mockResolvedValue(updated as any);

      const res = await request(app)
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          wholesalePrice: 34.99,
          stock: 450,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.wholesalePrice).toBe(34.99);
      expect(res.body.data.stock).toBe(450);
    });
  });

  describe('3. Delete Product (DELETE /api/v1/products/:id)', () => {
    it('should soft-delete/deactivate product with Admin credentials', async () => {
      vi.spyOn(ProductService, 'deleteProduct').mockResolvedValue({
        id: productId,
        status: 'DISCONTINUED',
        deletedAt: new Date(),
      } as any);

      const res = await request(app)
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('removed successfully');
    });

    it('should forbid non-admin from deleting products', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${distributorToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Search Products (GET /api/v1/products?search=...)', () => {
    it('should query products matching search term', async () => {
      const mockResults = {
        items: [
          {
            id: productId,
            name: 'ActiveFit Graduated Compression Hosiery Pro',
            sku: 'CLO-COMP-001',
            mrp: 49.99,
            bv: 25.0,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      vi.spyOn(ProductService, 'getProducts').mockResolvedValue(mockResults as any);

      const res = await request(app)
        .get('/api/v1/products?search=compression')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toContain('Compression');
    });
  });

  describe('5. Filtering Products (Category, Price, BV, Stock, Sort)', () => {
    it('should filter products by category, price boundaries, and stock status', async () => {
      const mockFiltered = {
        items: [
          {
            id: productId,
            name: 'ActiveFit Graduated Compression Hosiery Pro',
            wholesalePrice: 29.99,
            bv: 25.0,
            stock: 500,
            category: { slug: 'clothes-hosiery' },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      vi.spyOn(ProductService, 'getProducts').mockResolvedValue(mockFiltered as any);

      const res = await request(app)
        .get('/api/v1/products?category=clothes-hosiery&minPrice=20&maxPrice=100&minBV=15&stock=in_stock&sort=price_low')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].wholesalePrice).toBeGreaterThanOrEqual(20);
      expect(res.body.data[0].wholesalePrice).toBeLessThanOrEqual(100);
      expect(res.body.data[0].bv).toBeGreaterThanOrEqual(15);
    });
  });

  describe('6. Slugify & Enums Verification', () => {
    it('should generate clean URL-friendly slugs', () => {
      expect(slugify('ActiveFit Compression Hosiery Pro!')).toBe('activefit-compression-hosiery-pro');
      expect(slugify('Kashvi Smart Vitality Band 4')).toBe('kashvi-smart-vitality-band-4');
    });

    it('should validate all supported product status enums', () => {
      for (const st of ['DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'INACTIVE']) {
        expect(productStatusEnum.safeParse(st).success).toBe(true);
      }
      expect(productStatusEnum.safeParse('INVALID').success).toBe(false);
    });

    it('should validate all supported sort options', () => {
      for (const s of ['featured', 'newest', 'price_low', 'price_high', 'BV']) {
        expect(productSortEnum.safeParse(s).success).toBe(true);
      }
      expect(productSortEnum.safeParse('invalid_sort').success).toBe(false);
    });
  });
});
