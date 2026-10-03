import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service.js';
import { AuthRequest } from '../../middleware/auth.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';

export class ProductController {
  private static verifyIdOwner(req: AuthRequest): boolean {
    const memberId = req.user?.memberId;
    const role = (req.user?.role || '').toLowerCase();
    const cleanUser = (req.user?.username || '').toLowerCase().replace(/[@4]/g, 'a');
    return (
      memberId === '88767139' ||
      memberId === 'KV-1001' ||
      memberId === '18618331' ||
      role === 'admin' ||
      role === 'owner' ||
      cleanUser.includes('rahul')
    );
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, search } = req.query;
      const products = await ProductService.getAll(category as string, search as string);
      res.status(200).json({ success: true, count: products.length, data: products });
    } catch (err) {
      next(err);
    }
  }

  static async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const product = await ProductService.getById(id);
      res.status(200).json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ProductController.verifyIdOwner(req)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied. Only the verified ID Owner (88767139 / Rahul Kaushal) or Admin can add products.',
        });
        return;
      }
      const newProduct = await ProductService.create(req.body);

      // Immutable Audit Log: PRODUCT_CREATED
      await AuditService.recordFromRequest(
        req,
        AuditAction.PRODUCT_CREATED,
        'Product',
        newProduct?.id || newProduct?.sku || null,
        null,
        newProduct
      );

      res.status(201).json({
        success: true,
        message: 'Product created and published to wholesale catalog.',
        data: newProduct,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ProductController.verifyIdOwner(req)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied. Only the verified ID Owner (88767139) can update product pricing.',
        });
        return;
      }
      const { id } = req.params;
      const oldProduct = await ProductService.getById(id);
      const updated = await ProductService.updatePricingAndDetails(id, req.body);

      // Immutable Audit Log: PRODUCT_UPDATED
      await AuditService.recordFromRequest(
        req,
        AuditAction.PRODUCT_UPDATED,
        'Product',
        id,
        oldProduct,
        updated
      );

      res.status(200).json({
        success: true,
        message: 'Product price and volume points updated.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ProductController.verifyIdOwner(req)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied. Only the verified ID Owner (88767139) can delete products.',
        });
        return;
      }
      const { id } = req.params;
      const oldProduct = await ProductService.getById(id);
      await ProductService.deleteProduct(id);

      // Immutable Audit Log: PRODUCT_DELETED
      await AuditService.recordFromRequest(
        req,
        AuditAction.PRODUCT_DELETED,
        'Product',
        id,
        oldProduct,
        null
      );

      res.status(200).json({ success: true, message: `Product ${id} removed from catalog.` });
    } catch (err) {
      next(err);
    }
  }

  static async bulkDelete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ProductController.verifyIdOwner(req)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied. Only the verified ID Owner (88767139) can delete products.',
        });
        return;
      }
      const { ids } = req.body;
      await ProductService.bulkDelete(ids);
      res.status(200).json({ success: true, message: `Successfully deleted ${ids.length} products.` });
    } catch (err) {
      next(err);
    }
  }

  static async resetZero(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ProductController.verifyIdOwner(req)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied. Only ID Owner (88767139) can reset catalog data.',
        });
        return;
      }
      const result = await ProductService.resetZero();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async loadPlaceholders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ProductController.verifyIdOwner(req)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied. Only ID Owner (88767139) can load placeholders.',
        });
        return;
      }
      const result = await ProductService.loadPlaceholders();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
