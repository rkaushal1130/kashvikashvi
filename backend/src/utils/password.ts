import argon2 from 'argon2';

/**
 * Argon2id Configuration Options:
 * - type: argon2id (hybrid variant resistant to both GPU cracking and side-channel timing attacks)
 * - memoryCost: 65,536 KiB (64 MiB) as recommended by OWASP Password Storage Guidelines
 * - timeCost: 3 iterations
 * - parallelism: 1 thread
 */
export const ARGON2_CONFIG: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

/**
 * Hashes a plaintext password using the industry-standard Argon2id algorithm.
 *
 * Security Invariants:
 * 1. Passwords are NEVER stored in plaintext.
 * 2. Passwords are NEVER logged.
 * 3. Invalid inputs (empty, non-string, or oversized) are rejected safely.
 *
 * @param password Plaintext password to hash
 * @returns Cryptographic Argon2id hash string
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string.');
  }

  // Prevent DoS attack through oversized inputs (>1024 chars)
  if (password.length > 1024) {
    throw new Error('Password exceeds maximum permissible length of 1024 characters.');
  }

  return await argon2.hash(password, ARGON2_CONFIG);
}

/**
 * Compares an entered plaintext password against a stored cryptographic hash.
 *
 * Security Invariants:
 * 1. Constant-time verification prevents side-channel timing attacks.
 * 2. Returns boolean true/false safely without leaking internal stack traces.
 * 3. Handles invalid or malformed hashes safely without crashing.
 *
 * @param password Plaintext password to verify
 * @param passwordHash Stored password hash
 * @returns true if matched, false otherwise
 */
export async function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  if (
    typeof password !== 'string' ||
    typeof passwordHash !== 'string' ||
    password.length === 0 ||
    passwordHash.length === 0
  ) {
    return false;
  }

  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    // Fails safely on malformed hash without leaking internals
    return false;
  }
}

/**
 * Backward compatibility alias for comparePassword.
 */
export const verifyPassword = comparePassword;

/**
 * Validates password strength according to enterprise security standards:
 * - Minimum 8 characters, maximum 128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (typeof password !== 'string' || password.length === 0) {
    return { isValid: false, message: 'Password is required.' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }

  if (password.length > 128) {
    return { isValid: false, message: 'Password cannot exceed 128 characters.' };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return {
      isValid: false,
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes user records before exposing them through API responses,
 * strictly stripping passwordHash and sensitive security hashes.
 */
export function sanitizeUserResponse<T extends Record<string, any>>(user: T): Omit<T, 'passwordHash' | 'securityPinHash' | 'twoFactorSecret'> {
  if (!user || typeof user !== 'object') {
    return user as any;
  }

  const {
    passwordHash: _pw,
    securityPinHash: _pin,
    twoFactorSecret: _2fa,
    ...safeUser
  } = user;

  return safeUser as any;
}
