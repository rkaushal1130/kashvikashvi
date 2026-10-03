/**
 * Safe Decimal and Financial Arithmetic Utility
 * Prevents JavaScript floating-point errors (e.g. 0.1 + 0.2 !== 0.3)
 * Provides precision arithmetic for MLM Business Volume and Commissions.
 */
export class SafeDecimal {
  /**
   * Round to specified decimal places (default: 2 for currency / BV)
   */
  public static round(val: number | string, decimals: number = 2): number {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
  }

  /**
   * Safe Addition: a + b
   */
  public static add(a: number | string, b: number | string, decimals: number = 2): number {
    const numA = typeof a === 'string' ? parseFloat(a) : a;
    const numB = typeof b === 'string' ? parseFloat(b) : b;
    return SafeDecimal.round(numA + numB, decimals);
  }

  /**
   * Safe Subtraction: a - b
   */
  public static sub(a: number | string, b: number | string, decimals: number = 2): number {
    const numA = typeof a === 'string' ? parseFloat(a) : a;
    const numB = typeof b === 'string' ? parseFloat(b) : b;
    return SafeDecimal.round(numA - numB, decimals);
  }

  /**
   * Safe Multiplication: a * b
   */
  public static mul(a: number | string, b: number | string, decimals: number = 2): number {
    const numA = typeof a === 'string' ? parseFloat(a) : a;
    const numB = typeof b === 'string' ? parseFloat(b) : b;
    return SafeDecimal.round(numA * numB, decimals);
  }

  /**
   * Safe Division: a / b
   */
  public static div(a: number | string, b: number | string, decimals: number = 2): number {
    const numA = typeof a === 'string' ? parseFloat(a) : a;
    const numB = typeof b === 'string' ? parseFloat(b) : b;
    if (numB === 0) {
      throw new Error('SafeDecimal: Division by zero');
    }
    return SafeDecimal.round(numA / numB, decimals);
  }

  /**
   * Minimum of two values
   */
  public static min(a: number | string, b: number | string): number {
    const numA = typeof a === 'string' ? parseFloat(a) : a;
    const numB = typeof b === 'string' ? parseFloat(b) : b;
    return Math.min(numA, numB);
  }

  /**
   * Maximum of two values
   */
  public static max(a: number | string, b: number | string): number {
    const numA = typeof a === 'string' ? parseFloat(a) : a;
    const numB = typeof b === 'string' ? parseFloat(b) : b;
    return Math.max(numA, numB);
  }
}
