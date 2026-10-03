import { Prisma } from '@prisma/client';

/**
 * Safe Decimal and Financial Arithmetic Utility
 * Prevents JavaScript binary floating-point errors (e.g. 0.1 + 0.2 !== 0.3).
 * Built on Prisma.Decimal (decimal.js) to guarantee exact arbitrary-precision arithmetic
 * for MLM Business Volume (BV), commission percentages, and financial payouts.
 */
export class SafeDecimal {
  /**
   * Converts any number, string, or Prisma.Decimal into a Prisma.Decimal instance
   */
  public static toDecimal(val: Prisma.Decimal.Value | number | string): Prisma.Decimal {
    if (val instanceof Prisma.Decimal) {
      return val;
    }
    if (typeof val === 'number') {
      if (isNaN(val)) return new Prisma.Decimal('0.00');
      return new Prisma.Decimal(val.toString());
    }
    if (!val || typeof val !== 'string') {
      return new Prisma.Decimal('0.00');
    }
    const trimmed = val.trim();
    if (!trimmed) return new Prisma.Decimal('0.00');
    try {
      return new Prisma.Decimal(trimmed);
    } catch {
      return new Prisma.Decimal('0.00');
    }
  }

  /**
   * Round to specified decimal places (default: 2 for currency / BV) using ROUND_HALF_UP.
   * Returns a standard JavaScript number.
   */
  public static round(val: Prisma.Decimal.Value | number | string, decimals: number = 2): number {
    return SafeDecimal.toDecimal(val)
      .toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  /**
   * Round to specified decimal places returning a Prisma.Decimal instance.
   */
  public static roundDecimal(val: Prisma.Decimal.Value | number | string, decimals: number = 2): Prisma.Decimal {
    return SafeDecimal.toDecimal(val).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Exact Safe Addition: a + b
   */
  public static add(
    a: Prisma.Decimal.Value | number | string,
    b: Prisma.Decimal.Value | number | string,
    decimals: number = 2
  ): Prisma.Decimal {
    const decA = SafeDecimal.toDecimal(a);
    const decB = SafeDecimal.toDecimal(b);
    return decA.add(decB).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Exact Safe Subtraction: a - b
   */
  public static sub(
    a: Prisma.Decimal.Value | number | string,
    b: Prisma.Decimal.Value | number | string,
    decimals: number = 2
  ): Prisma.Decimal {
    const decA = SafeDecimal.toDecimal(a);
    const decB = SafeDecimal.toDecimal(b);
    return decA.sub(decB).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Exact Safe Multiplication: a * b
   */
  public static mul(
    a: Prisma.Decimal.Value | number | string,
    b: Prisma.Decimal.Value | number | string,
    decimals: number = 2
  ): Prisma.Decimal {
    const decA = SafeDecimal.toDecimal(a);
    const decB = SafeDecimal.toDecimal(b);
    return decA.mul(decB).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Exact Safe Division: a / b
   */
  public static div(
    a: Prisma.Decimal.Value | number | string,
    b: Prisma.Decimal.Value | number | string,
    decimals: number = 2
  ): Prisma.Decimal {
    const decA = SafeDecimal.toDecimal(a);
    const decB = SafeDecimal.toDecimal(b);
    if (decB.isZero()) {
      throw new Error('SafeDecimal: Division by zero');
    }
    return decA.div(decB).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Calculates commission amount from order BV and rate percentage:
   * (orderBV * ratePercentage) / 100
   * Performs exact decimal multiplication and division without IEEE 754 floating point imprecision.
   *
   * @param orderBV Base Business Volume
   * @param ratePercentage Commission percentage (e.g. 24.00, 8.00, 13.00, 5.00, 4.00)
   * @param decimals Precision (default 2)
   */
  public static calculateCommissionAmount(
    orderBV: Prisma.Decimal.Value | number | string,
    ratePercentage: Prisma.Decimal.Value | number | string,
    decimals: number = 2
  ): Prisma.Decimal {
    const bv = SafeDecimal.toDecimal(orderBV);
    const rate = SafeDecimal.toDecimal(ratePercentage);
    if (bv.lessThanOrEqualTo(0) || rate.lessThanOrEqualTo(0)) {
      return new Prisma.Decimal('0.00');
    }
    // (orderBV * ratePercentage) / 100
    return bv.mul(rate).div(new Prisma.Decimal(100)).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Minimum of two decimal values
   */
  public static min(
    a: Prisma.Decimal.Value | number | string,
    b: Prisma.Decimal.Value | number | string
  ): Prisma.Decimal {
    const decA = SafeDecimal.toDecimal(a);
    const decB = SafeDecimal.toDecimal(b);
    return decA.lessThan(decB) ? decA : decB;
  }

  /**
   * Maximum of two decimal values
   */
  public static max(
    a: Prisma.Decimal.Value | number | string,
    b: Prisma.Decimal.Value | number | string
  ): Prisma.Decimal {
    const decA = SafeDecimal.toDecimal(a);
    const decB = SafeDecimal.toDecimal(b);
    return decA.greaterThan(decB) ? decA : decB;
  }

  /**
   * Equality check between two decimal values
   */
  public static equals(
    a: Prisma.Decimal.Value | number | string,
    b: Prisma.Decimal.Value | number | string
  ): boolean {
    const decA = SafeDecimal.toDecimal(a);
    const decB = SafeDecimal.toDecimal(b);
    return decA.equals(decB);
  }
}
