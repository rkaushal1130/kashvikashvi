import { Prisma } from '@prisma/client';

/**
 * GST pricing helpers.
 *
 * Distributor Price (DP / wholesalePrice) is GST-EXCLUSIVE: the payable amount is
 * DP x qty + GST, where GST is calculated per order line and rounded to 2 decimals
 * (half-up). The storefront (ShopView.jsx) uses the same per-line rounding, so the
 * amount shown to the distributor equals the amount charged.
 *
 * MRP / retail price stays GST-INCLUSIVE (Indian MRP includes all taxes), so
 * customer orders at MRP add no GST on top.
 */
export const DEFAULT_GST_RATE = 18;

export function gstRateOf(product: { gstRate?: unknown } | null | undefined): number {
  const rate = Number(product?.gstRate ?? DEFAULT_GST_RATE);
  return Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_GST_RATE;
}

/** GST on a GST-exclusive line total, rounded to 2 decimals (half-up). */
export function exclusiveLineGst(lineTotal: Prisma.Decimal, gstRate: number): Prisma.Decimal {
  return lineTotal.mul(gstRate).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
