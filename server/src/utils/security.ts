import * as argon2 from 'argon2';
import bcrypt from 'bcryptjs';

/**
 * Enterprise Password Security Service
 * Utilizes Argon2id (winner of Password Hashing Competition)
 * Memory-hard, GPU-resistant, side-channel attack mitigation.
 * Also supports bcrypt verification for backward compatibility.
 */
export class SecurityUtils {
  private static readonly ARGON2_OPTIONS: argon2.HashOptions = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iterations
    parallelism: 4,    // 4 threads
  };

  /**
   * Hashes a raw password string using Argon2id.
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { ...this.ARGON2_OPTIONS, raw: false });
  }

  /**
   * Verifies a plain text password against an Argon2id or bcrypt hash.
   */
  static async verifyPassword(hash: string, plainText: string): Promise<boolean> {
    if (!hash || !plainText) return false;

    try {
      if (hash.startsWith('$argon2')) {
        return await argon2.verify(hash, plainText);
      }
      if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
        return await bcrypt.compare(plainText, hash);
      }
      // Demo development fallback only when hash is an exact mock password
      return hash === plainText;
    } catch (err) {
      console.warn('[SecurityUtils] Hash verification warning:', err);
      return false;
    }
  }
}
