import { Router } from 'express';
import { CartController } from './cart.controller.js';
import { optionalAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { cartItemSchema, updateCartItemSchema, validateCartSchema } from '../../schemas/cart.schemas.js';

export const cartRoutes = Router();

cartRoutes.use(optionalAuth);

// 1. GET /api/v1/cart - Retrieve current cart details, BV points, and shipping
cartRoutes.get('/', CartController.getCart);

// 2. POST /api/v1/cart/items - Add or increment item in cart
cartRoutes.post('/items', validateRequest({ body: cartItemSchema }), CartController.addItem);

// 3. PUT /api/v1/cart/items/:productId - Update item quantity
cartRoutes.put('/items/:productId', validateRequest({ body: updateCartItemSchema }), CartController.updateItem);

// 4. DELETE /api/v1/cart/items/:productId - Remove item from cart
cartRoutes.delete('/items/:productId', CartController.removeItem);

// 5. POST /api/v1/cart/clear - Empty the cart
cartRoutes.post('/clear', CartController.clearCart);

// 6. POST /api/v1/cart/validate - Validate stock, minimum BV, and recalculate
cartRoutes.post('/validate', validateRequest({ body: validateCartSchema }), CartController.validateCart);

export default cartRoutes;
