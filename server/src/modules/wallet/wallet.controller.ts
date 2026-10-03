import { Response, NextFunction } from 'express';
import { WalletService } from './wallet.service.js';
import { AuthRequest } from '../../middleware/auth.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';

export class WalletController {
  static async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Do not trust IDs from frontend: verify ownership
      const targetMemberId = req.params.memberId || req.user?.memberId;
      if (!targetMemberId) {
        res.status(400).json({ success: false, message: 'Member ID required.' });
        return;
      }

      const isOwner = req.user?.memberId === targetMemberId || req.user?.id === targetMemberId;
      const isAdmin = req.user?.role?.toLowerCase() === 'admin';

      if (!isOwner && !isAdmin && req.params.memberId) {
        res.status(403).json({
          success: false,
          message: 'Ownership verification failed: You cannot access wallet balance of another member.',
        });
        return;
      }

      const balance = await WalletService.getBalance(targetMemberId);
      res.status(200).json({ success: true, data: balance });
    } catch (err) {
      next(err);
    }
  }

  static async getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetMemberId = req.params.memberId || req.user?.memberId;
      if (!targetMemberId) {
        res.status(400).json({ success: false, message: 'Member ID required.' });
        return;
      }

      const isOwner = req.user?.memberId === targetMemberId || req.user?.id === targetMemberId;
      const isAdmin = req.user?.role?.toLowerCase() === 'admin';

      if (!isOwner && !isAdmin && req.params.memberId) {
        res.status(403).json({
          success: false,
          message: 'Ownership verification failed: You cannot view transaction history of another member.',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const txs = await WalletService.getTransactions(targetMemberId, limit);
      res.status(200).json({ success: true, count: txs.length, data: txs });
    } catch (err) {
      next(err);
    }
  }

  static async withdraw(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Always bind withdrawal to authenticated session, NEVER frontend body member ID
      const memberId = req.user?.memberId;
      if (!memberId) {
        res.status(401).json({ success: false, message: 'Unauthenticated.' });
        return;
      }

      const amount = parseFloat(req.body.amount);
      if (!amount || isNaN(amount) || amount <= 0) {
        res.status(400).json({ success: false, message: 'Valid positive withdrawal amount is required.' });
        return;
      }

      // Minimum withdrawal limit validation
      if (amount < 500) {
        res.status(400).json({
          success: false,
          message: 'Minimum withdrawal amount is ₹500.00.',
        });
        return;
      }

      const result = await WalletService.requestWithdrawal(memberId, amount);

      // Immutable Audit Log: WALLET_ADJUSTMENT
      await AuditService.recordFromRequest(
        req,
        AuditAction.WALLET_ADJUSTMENT,
        'Wallet',
        memberId,
        null,
        { withdrawalAmount: amount, referenceId: (result as any)?.payoutBatchCode || 'WITHDRAWAL_REQUEST' }
      );

      res.status(200).json({
        success: true,
        message: 'Withdrawal request submitted successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
