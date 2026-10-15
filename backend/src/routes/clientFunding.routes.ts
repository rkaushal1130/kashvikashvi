import { Router } from 'express';
import { ClientFundingController } from '../controllers/clientFunding.controller';
import { authenticate } from '../middleware/auth';

export const clientFundingRouter = Router();

// Public webhook endpoint (does not require user JWT)
clientFundingRouter.post('/webhook', ClientFundingController.handleWebhook);
clientFundingRouter.post('/razorpay/webhook', ClientFundingController.handleWebhook);

// Protected endpoints for authenticated clients
clientFundingRouter.use(authenticate);

// 1. Client Funding Orders
clientFundingRouter.post('/orders', ClientFundingController.createOrder);
clientFundingRouter.post('/initiate', ClientFundingController.createOrder);
clientFundingRouter.post('/verify', ClientFundingController.verifyPayment);
clientFundingRouter.get('/orders', ClientFundingController.listOrders);
clientFundingRouter.get('/history', ClientFundingController.listOrders);
clientFundingRouter.get('/orders/:id', ClientFundingController.getOrderById);

// 2. Client Bank Account Management
clientFundingRouter.get('/bank-accounts', ClientFundingController.listBankAccounts);
clientFundingRouter.post('/bank-accounts', ClientFundingController.addBankAccount);
clientFundingRouter.post('/bank-accounts/:id/verify', ClientFundingController.verifyBankAccount);
clientFundingRouter.delete('/bank-accounts/:id', ClientFundingController.deleteBankAccount);
