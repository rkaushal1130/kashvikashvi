import { NextFunction, Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { sendSuccess } from '../utils/apiResponse';

export class ProductController {
  /**
   * Retrieves paginated products with filtering and sorting.
   * GET /api/v1/products
   */
  public static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ProductService.getProducts(req.query as any);
      sendSuccess(res, {
        message: 'Product catalog retrieved successfully.',
        data: result.items,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves single product by slug or UUID.
   * GET /api/v1/products/:slug
   */
  public static async getProductBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.getProductBySlug(req.params.slug);
      sendSuccess(res, {
        message: 'Product details retrieved.',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin-Only: Creates a new product.
   * POST /api/v1/products
   */
  public static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.createProduct(req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Product created successfully.',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin-Only: Updates a product by ID.
   * PATCH /api/v1/products/:id
   */
  public static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await ProductService.updateProduct(req.params.id, req.body);
      sendSuccess(res, {
        message: 'Product updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin-Only: Soft-deletes a product by ID.
   * DELETE /api/v1/products/:id
   */
  public static async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ProductService.deleteProduct(req.params.id);
      sendSuccess(res, {
        message: 'Product removed successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves all database-driven categories.
   * GET /api/v1/categories or GET /api/v1/products/categories/all
   */
  public static async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await ProductService.getCategories();
      sendSuccess(res, {
        message: 'Product categories retrieved successfully.',
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }
}
