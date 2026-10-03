import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { ProductService } from '../products/product.service.js';

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  imageUrl: string;
  mrp: number;
  distributorPrice: number;
  volumeBv: number;
  quantity: number;
  subtotal: number;
  totalBv: number;
}

// In-memory session cart store keyed by userId or session
const userCartStore = new Map<string, { productId: string; quantity: number }[]>();

export class CartController {
  private static getCartKey(req: AuthRequest): string {
    return req.user?.id || req.user?.memberId || req.ip || 'guest-session';
  }

  static async getCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = CartController.getCartKey(req);
      const rawItems = userCartStore.get(key) || [];

      const cartDetails = await CartController.hydrateItems(rawItems);
      res.status(200).json({
        success: true,
        data: cartDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  static async addItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, quantity } = req.body;
      const key = CartController.getCartKey(req);

      const product = await ProductService.getById(productId);

      if (!product) {
        res.status(404).json({
          success: false,
          message: `Product with ID '${productId}' not found in wholesale catalog.`,
        });
        return;
      }

      if (product.stockQuantity < quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for '${product.name}'. Available: ${product.stockQuantity}, Requested: ${quantity}`,
        });
        return;
      }

      const items = userCartStore.get(key) || [];
      const existingIndex = items.findIndex((i) => i.productId === productId);

      if (existingIndex > -1) {
        items[existingIndex].quantity += quantity;
      } else {
        items.push({ productId, quantity });
      }

      userCartStore.set(key, items);

      const cartDetails = await CartController.hydrateItems(items);
      res.status(200).json({
        success: true,
        message: 'Item added to cart successfully.',
        data: cartDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const { quantity } = req.body;
      const key = CartController.getCartKey(req);

      let items = userCartStore.get(key) || [];

      if (quantity <= 0) {
        items = items.filter((i) => i.productId !== productId);
      } else {
        const item = items.find((i) => i.productId === productId);
        if (item) {
          item.quantity = quantity;
        } else {
          items.push({ productId, quantity });
        }
      }

      userCartStore.set(key, items);

      const cartDetails = await CartController.hydrateItems(items);
      res.status(200).json({
        success: true,
        message: 'Cart item updated successfully.',
        data: cartDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  static async removeItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const key = CartController.getCartKey(req);

      let items = userCartStore.get(key) || [];
      items = items.filter((i) => i.productId !== productId);
      userCartStore.set(key, items);

      const cartDetails = await CartController.hydrateItems(items);
      res.status(200).json({
        success: true,
        message: 'Item removed from cart.',
        data: cartDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  static async clearCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = CartController.getCartKey(req);
      userCartStore.delete(key);

      res.status(200).json({
        success: true,
        message: 'Cart cleared successfully.',
        data: {
          items: [],
          totalItems: 0,
          totalMrp: 0,
          totalDistributorPrice: 0,
          totalSavings: 0,
          totalBv: 0,
          shippingFee: 0,
          grandTotal: 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async validateCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items } = req.body;
      const cartDetails = await CartController.hydrateItems(items);

      res.status(200).json({
        success: true,
        message: 'Cart validated successfully.',
        data: cartDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  private static async hydrateItems(rawItems: { productId: string; quantity: number }[]) {
    if (!rawItems.length) {
      return {
        items: [],
        totalItems: 0,
        totalMrp: 0,
        totalDistributorPrice: 0,
        totalSavings: 0,
        totalBv: 0,
        shippingFee: 0,
        grandTotal: 0,
      };
    }

    let totalItems = 0;
    let totalMrp = 0;
    let totalDistributorPrice = 0;
    let totalBv = 0;

    const items: CartItem[] = [];

    for (const raw of rawItems) {
      const p = await ProductService.getById(raw.productId);
      if (!p) continue;

      const mrpNum = Number(p.mrp);
      const dpNum = Number(p.distributorPrice);
      const bvNum = Number(p.volumeBv);
      const subtotal = dpNum * raw.quantity;
      const itemBv = bvNum * raw.quantity;

      totalItems += raw.quantity;
      totalMrp += mrpNum * raw.quantity;
      totalDistributorPrice += subtotal;
      totalBv += itemBv;

      items.push({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        imageUrl: p.imageUrl || '',
        mrp: mrpNum,
        distributorPrice: dpNum,
        volumeBv: bvNum,
        quantity: raw.quantity,
        subtotal,
        totalBv: itemBv,
      });
    }

    const totalSavings = Math.max(0, totalMrp - totalDistributorPrice);
    const shippingFee = totalDistributorPrice >= 999 || totalDistributorPrice === 0 ? 0 : 70;
    const grandTotal = totalDistributorPrice + shippingFee;

    return {
      items,
      totalItems,
      totalMrp,
      totalDistributorPrice,
      totalSavings,
      totalBv,
      shippingFee,
      grandTotal,
    };
  }
}
