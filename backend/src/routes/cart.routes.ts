import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  addToCartSchema,
  cartItemIdParamSchema,
  updateCartItemSchema,
} from '../validators/cart.validators';

const router = Router();

// All cart endpoints require authentication
router.use(authenticate);

// GET /api/v1/cart - Retrieve current user's shopping cart
router.get('/', CartController.getCart);

// POST /api/v1/cart/items - Add product to cart
router.post(
  '/items',
  validate({ body: addToCartSchema }),
  CartController.addItem
);

// PATCH /api/v1/cart/items/:id - Update item quantity in cart
router.patch(
  '/items/:id',
  validate({ params: cartItemIdParamSchema, body: updateCartItemSchema }),
  CartController.updateItem
);

// DELETE /api/v1/cart/items/:id - Remove item from cart
router.delete(
  '/items/:id',
  validate({ params: cartItemIdParamSchema }),
  CartController.removeItem
);

// DELETE /api/v1/cart - Clear entire cart
router.delete('/', CartController.clearCart);

export const cartRouter = router;
