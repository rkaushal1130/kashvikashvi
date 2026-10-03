import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createOrderSchema,
  orderIdParamSchema,
  orderQuerySchema,
  adminAdjustOrderBVSchema,
  updateOrderStatusSchema,
} from '../validators/order.validators';

const router = Router();

// All order endpoints require authentication
router.use(authenticate);

// POST /api/v1/orders - Create an order with strict 10-step transactional verification
router.post(
  '/',
  validate({ body: createOrderSchema }),
  OrderController.createOrder
);

// GET /api/v1/orders - List user orders (or all if admin)
router.get(
  '/',
  validate({ query: orderQuerySchema }),
  OrderController.getOrders
);

// GET /api/v1/orders/:id - Get order details
router.get(
  '/:id',
  validate({ params: orderIdParamSchema }),
  OrderController.getOrderById
);

// POST /api/v1/orders/:id/cancel - Cancel order and restore stock/BV
router.post(
  '/:id/cancel',
  validate({ params: orderIdParamSchema }),
  OrderController.cancelOrder
);

// PUT /api/v1/orders/:id/bv - Admin adjustment of commissionable Business Volume
router.put(
  '/:id/bv',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ params: orderIdParamSchema, body: adminAdjustOrderBVSchema }),
  OrderController.adminAdjustBV
);

// PUT /api/v1/orders/:id/status - Admin update order status (triggers lifecycle progression)
router.put(
  '/:id/status',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ params: orderIdParamSchema, body: updateOrderStatusSchema }),
  OrderController.updateOrderStatus
);

// POST /api/v1/orders/:id/process-commission - Authoritative commission processing trigger (Prompt 21)
router.post(
  '/:id/process-commission',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ params: orderIdParamSchema }),
  OrderController.processCommission
);

// GET /api/v1/orders/:id/commission-lifecycle - Inspect commission lifecycle status
router.get(
  '/:id/commission-lifecycle',
  validate({ params: orderIdParamSchema }),
  OrderController.getCommissionLifecycleStatus
);

export const orderRouter = router;
