import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  productIdParamSchema,
  productQuerySchema,
  productSlugParamSchema,
  updateProductSchema,
} from '../validators/product.validators';

const router = Router();

// GET /api/v1/products/categories - List database-driven categories
router.get('/categories', ProductController.getCategories);

// GET /api/v1/products - List products with filters and sorting
router.get(
  '/',
  validate({ query: productQuerySchema }),
  ProductController.getProducts
);

// GET /api/v1/products/:slug - Retrieve product by slug or ID
router.get(
  '/:slug',
  validate({ params: productSlugParamSchema }),
  ProductController.getProductBySlug
);

// Admin-Only: POST /api/v1/products - Create a new product
router.post(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ body: createProductSchema }),
  ProductController.createProduct
);

// Admin-Only: PATCH /api/v1/products/:id - Update product
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  ProductController.updateProduct
);

// Admin-Only: DELETE /api/v1/products/:id - Soft-delete product
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ params: productIdParamSchema }),
  ProductController.deleteProduct
);

export const productRouter = router;
