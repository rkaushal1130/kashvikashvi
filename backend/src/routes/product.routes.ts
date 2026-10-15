import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate } from '../middleware/auth';
import { requireProductManagementAccess } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  productIdParamSchema,
  productQuerySchema,
  productSlugParamSchema,
  updateProductSchema,
} from '../validators/product.validators';

const router = Router();

// ==========================================
// PUBLIC CATALOG BROWSING ENDPOINTS
// Accessible to distributors, retail customers, and visitors
// ==========================================

// GET /api/v1/products/categories - List database-driven categories
router.get('/categories', ProductController.getCategories);

// GET /api/v1/products - List products with filters and sorting
router.get(
  '/',
  validate({ query: productQuerySchema }),
  ProductController.getProducts
);

// ==========================================
// ADMIN & AUTHORIZED OWNER ONLY MANAGEMENT ENDPOINTS
// Strictly protected: 401 for unauthenticated, 403 for regular distributors / sponsored users
// ==========================================

// Bulk Delete Products
router.post(
  '/bulk-delete',
  authenticate,
  requireProductManagementAccess,
  ProductController.bulkDelete
);

// Reset Catalog Pricing and BV to Zero
router.post(
  '/reset-zero',
  authenticate,
  requireProductManagementAccess,
  ProductController.resetZero
);

// Load / Restore Placeholder Catalog
router.post(
  '/load-placeholders',
  authenticate,
  requireProductManagementAccess,
  ProductController.loadPlaceholders
);

// GET /api/v1/products/:slug - Retrieve product by slug or ID (Public read)
router.get(
  '/:slug',
  validate({ params: productSlugParamSchema }),
  ProductController.getProductBySlug
);

// Create a new product
router.post(
  '/',
  authenticate,
  requireProductManagementAccess,
  validate({ body: createProductSchema }),
  ProductController.createProduct
);

// Full update / replace product
router.put(
  '/:id',
  authenticate,
  requireProductManagementAccess,
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  ProductController.putProduct
);

// Partial update product (pricing, BV, stock, status)
router.patch(
  '/:id',
  authenticate,
  requireProductManagementAccess,
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  ProductController.updateProduct
);

// Soft-delete product
router.delete(
  '/:id',
  authenticate,
  requireProductManagementAccess,
  validate({ params: productIdParamSchema }),
  ProductController.deleteProduct
);

export const productRouter = router;

