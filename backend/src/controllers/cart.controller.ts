import { NextFunction, Request, Response } from 'express';
import { CartService } from '../services/cart.service';
import { sendSuccess } from '../utils/apiResponse';

export class CartController {
  /**
   * Retrieves current user's shopping cart.
   * GET /api/v1/cart
   */
  public static async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await CartService.getOrCreateCart(req.user!.id);
      sendSuccess(res, {
        message: 'Cart retrieved successfully.',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adds an item to the shopping cart.
   * POST /api/v1/cart/items
   */
  public static async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await CartService.addItem(req.user!.id, req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Item added to cart.',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an item's quantity in the shopping cart.
   * PATCH /api/v1/cart/items/:id
   */
  public static async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await CartService.updateItem(req.user!.id, req.params.id, req.body);
      sendSuccess(res, {
        message: 'Cart item updated.',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Removes an item from the shopping cart.
   * DELETE /api/v1/cart/items/:id
   */
  public static async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await CartService.removeItem(req.user!.id, req.params.id);
      sendSuccess(res, {
        message: 'Item removed from cart.',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clears all items from the shopping cart.
   * DELETE /api/v1/cart
   */
  public static async clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await CartService.clearCart(req.user!.id);
      sendSuccess(res, {
        message: 'Cart cleared successfully.',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }
}
