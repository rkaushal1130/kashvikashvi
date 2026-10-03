import { Router } from 'express';
import { SupportController } from './support.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import {
  createTicketSchema,
  createMessageSchema,
  updateTicketSchema,
} from '../../schemas/support.schemas.js';

export const supportRoutes = Router();

// ============================================================================
// Support Tickets REST API: /api/v1/support/tickets
// ============================================================================

// 1. POST /api/v1/support/tickets - Submit new support ticket
supportRoutes.post(
  '/tickets',
  authLimiter,
  validateRequest({ body: createTicketSchema }),
  SupportController.createTicket
);
supportRoutes.post(
  '/',
  authLimiter,
  validateRequest({ body: createTicketSchema }),
  SupportController.createTicket
);

// 2. GET /api/v1/support/tickets - List all tickets with filtering
supportRoutes.get('/tickets', SupportController.getTickets);
supportRoutes.get('/', SupportController.getTickets);

// 3. GET /api/v1/support/tickets/:id - Get ticket details and threaded messages
supportRoutes.get('/tickets/:id', SupportController.getTicketById);
supportRoutes.get('/:id', SupportController.getTicketById);

// 4. POST /api/v1/support/tickets/:id/messages - Post message/reply to ticket thread
supportRoutes.post(
  '/tickets/:id/messages',
  validateRequest({ body: createMessageSchema }),
  SupportController.addMessage
);
supportRoutes.post(
  '/:id/messages',
  validateRequest({ body: createMessageSchema }),
  SupportController.addMessage
);

// 5. GET /api/v1/support/tickets/:id/messages - Get threaded messages for ticket
supportRoutes.get('/tickets/:id/messages', SupportController.getMessages);
supportRoutes.get('/:id/messages', SupportController.getMessages);

// 6. POST /api/v1/support/tickets/:id/close - Close ticket
supportRoutes.post('/tickets/:id/close', SupportController.closeTicket);
supportRoutes.post('/:id/close', SupportController.closeTicket);

// 7. PATCH /api/v1/support/tickets/:id - Update ticket status / priority
supportRoutes.patch(
  '/tickets/:id/status',
  validateRequest({ body: updateTicketSchema }),
  SupportController.updateTicket
);
supportRoutes.patch(
  '/:id/status',
  validateRequest({ body: updateTicketSchema }),
  SupportController.updateTicket
);
supportRoutes.patch(
  '/tickets/:id',
  validateRequest({ body: updateTicketSchema }),
  SupportController.updateTicket
);
supportRoutes.patch(
  '/:id',
  validateRequest({ body: updateTicketSchema }),
  SupportController.updateTicket
);

export default supportRoutes;
