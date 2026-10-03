import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';

const router = Router();

// GET /api/v1/categories
router.get('/', ProductController.getCategories);

export const categoryRouter = router;
