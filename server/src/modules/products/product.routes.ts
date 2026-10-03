import { Router } from 'express';
import { ProductController } from './product.controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  bulkDeleteSchema,
} from '../../schemas/product.schemas.js';

const router = Router();

// Public wholesale catalog viewing
router.get('/', ProductController.list);
router.get('/:id', ProductController.getOne);

// Protected actions restricted to ID Owner (88767139) / Admin
router.post('/', authenticateToken, validateRequest({ body: createProductSchema }), ProductController.create);
router.put('/:id', authenticateToken, validateRequest({ body: updateProductSchema }), ProductController.update);
router.delete('/:id', authenticateToken, ProductController.deleteOne);
router.post('/bulk-delete', authenticateToken, validateRequest({ body: bulkDeleteSchema }), ProductController.bulkDelete);
router.post('/reset-zero', authenticateToken, ProductController.resetZero);
router.post('/load-placeholders', authenticateToken, ProductController.loadPlaceholders);

export default router;
