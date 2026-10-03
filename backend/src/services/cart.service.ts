import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { AddToCartInput, UpdateCartItemInput } from '../validators/cart.validators';

export class CartService {
  /**
   * Retrieves or creates the shopping cart for a given user.
   * Recalculates subtotal and BV dynamically using current database values.
   */
  public static async getOrCreateCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                slug: true,
                wholesalePrice: true,
                mrp: true,
                retailPrice: true,
                distributorPrice: true,
                bv: true,
                stock: true,
                status: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true, altText: true },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  slug: true,
                  wholesalePrice: true,
                  mrp: true,
                  retailPrice: true,
                  distributorPrice: true,
                  bv: true,
                  stock: true,
                  status: true,
                  images: true,
                },
              },
            },
          },
        },
      });
    }

    return this.formatCart(cart);
  }

  /**
   * Adds an item to the cart.
   * Always verifies product existence, status, and live stock from database.
   */
  public static async addItem(userId: string, input: AddToCartInput) {
    const { productId, quantity } = input;

    // 1. Validate Product from DB
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.deletedAt !== null) {
      throw AppError.notFound('Product not found.', 'PRODUCT_NOT_FOUND');
    }

    if (product.status === 'INACTIVE' || product.status === 'DISCONTINUED') {
      throw AppError.badRequest('This product is no longer available for purchase.', 'PRODUCT_UNAVAILABLE');
    }

    if (product.stock <= 0 || product.status === 'OUT_OF_STOCK') {
      throw AppError.badRequest('This product is currently out of stock.', 'PRODUCT_OUT_OF_STOCK');
    }

    // 2. Resolve User's Cart
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    // 3. Check existing item in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    if (newQuantity > product.stock) {
      throw AppError.badRequest(
        `Requested quantity (${newQuantity}) exceeds available stock (${product.stock}).`,
        'INSUFFICIENT_STOCK'
      );
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
    }

    return await this.getOrCreateCart(userId);
  }

  /**
   * Updates the quantity of a specific cart item.
   */
  public static async updateItem(userId: string, cartItemId: string, input: UpdateCartItemInput) {
    const { quantity } = input;

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      throw AppError.notFound('Cart not found.', 'CART_NOT_FOUND');
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
      include: { product: true },
    });

    if (!item) {
      throw AppError.notFound('Item not found in cart.', 'CART_ITEM_NOT_FOUND');
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: cartItemId } });
    } else {
      if (quantity > item.product.stock) {
        throw AppError.badRequest(
          `Requested quantity (${quantity}) exceeds available stock (${item.product.stock}).`,
          'INSUFFICIENT_STOCK'
        );
      }
      await prisma.cartItem.update({
        where: { id: cartItemId },
        data: { quantity },
      });
    }

    return await this.getOrCreateCart(userId);
  }

  /**
   * Removes an item from the cart.
   */
  public static async removeItem(userId: string, cartItemId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      throw AppError.notFound('Cart not found.', 'CART_NOT_FOUND');
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
    });

    if (!item) {
      throw AppError.notFound('Item not found in cart.', 'CART_ITEM_NOT_FOUND');
    }

    await prisma.cartItem.delete({ where: { id: cartItemId } });
    return await this.getOrCreateCart(userId);
  }

  /**
   * Clears all items from the cart.
   */
  public static async clearCart(userId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return await this.getOrCreateCart(userId);
  }

  /**
   * Formats cart and dynamically calculates totals from authoritative database prices.
   */
  private static formatCart(cart: any) {
    let subtotal = 0;
    let totalBV = 0;
    let totalItems = 0;

    const formattedItems = (cart.items || []).map((item: any) => {
      const product = item.product;
      const unitPrice = Number(product.wholesalePrice ?? product.distributorPrice ?? product.mrp ?? 0);
      const mrp = Number(product.mrp ?? product.retailPrice ?? unitPrice);
      const unitBV = Number(product.bv ?? 0);
      const itemTotal = unitPrice * item.quantity;
      const itemBV = unitBV * item.quantity;
      const isAvailable = product.status === 'ACTIVE' && product.stock >= item.quantity;

      subtotal += itemTotal;
      totalBV += itemBV;
      totalItems += item.quantity;

      return {
        id: item.id,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        thumbnailUrl: product.images?.[0]?.url || null,
        quantity: item.quantity,
        unitPrice,
        mrp,
        unitBV,
        totalPrice: Number(itemTotal.toFixed(2)),
        totalBV: Number(itemBV.toFixed(2)),
        stock: product.stock,
        isAvailable,
        status: product.status,
      };
    });

    return {
      id: cart.id,
      userId: cart.userId,
      items: formattedItems,
      itemsCount: totalItems,
      subtotal: Number(subtotal.toFixed(2)),
      totalBV: Number(totalBV.toFixed(2)),
      updatedAt: cart.updatedAt,
    };
  }
}
