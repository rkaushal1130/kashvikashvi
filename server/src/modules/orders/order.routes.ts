import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { checkoutSchema } from '../../schemas/order.schemas.js';

const router = Router();

router.post('/checkout', authenticateToken, validateRequest({ body: checkoutSchema }), OrderController.createOrder);
router.get('/my-orders', authenticateToken, OrderController.getMyOrders);
router.get('/:orderNumber', authenticateToken, OrderController.getOrderDetails);

export default router;
