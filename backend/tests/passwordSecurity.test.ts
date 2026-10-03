import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  comparePassword,
  verifyPassword,
  validatePasswordStrength,
  sanitizeUserResponse,
  ARGON2_CONFIG,
} from '../src/utils/password';

describe('PASSWORD SECURITY LAYER TESTS', () => {
  describe('1. Password Hashing (Argon2id)', () => {
    it('should hash a password into a valid Argon2id format', async () => {
      const password = 'SuperSecretPassword@2026';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      // Argon2id hashes must start with $argon2id$
      expect(hash.startsWith('$argon2id$')).toBe(true);
      // Plaintext password must NEVER match the hash
      expect(hash).not.toBe(password);
      expect(hash).not.toContain(password);
    });

    it('should produce unique salts and hashes for identical passwords', async () => {
      const password = 'IdenticalPassword#123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(hash1.startsWith('$argon2id$')).toBe(true);
      expect(hash2.startsWith('$argon2id$')).toBe(true);
    });

    it('should adhere to production-grade Argon2id configuration (OWASP standard)', () => {
      expect(ARGON2_CONFIG.type).toBeDefined();
      expect(ARGON2_CONFIG.memoryCost).toBe(65536); // 64 MB
      expect(ARGON2_CONFIG.timeCost).toBe(3); // 3 iterations
      expect(ARGON2_CONFIG.parallelism).toBe(1);
    });

    it('should safely reject empty or non-string inputs', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string.');
      await expect(hashPassword(null as any)).rejects.toThrow('Password must be a non-empty string.');
      await expect(hashPassword(undefined as any)).rejects.toThrow('Password must be a non-empty string.');
      await expect(hashPassword(12345678 as any)).rejects.toThrow('Password must be a non-empty string.');
    });

    it('should safely reject oversized password inputs to prevent DoS', async () => {
      const massivePassword = 'A'.repeat(1025);
      await expect(hashPassword(massivePassword)).rejects.toThrow('Password exceeds maximum permissible length');
    });
  });

  describe('2. Password Comparison (comparePassword & verifyPassword)', () => {
    it('should return true when entered password matches the stored hash', async () => {
      const plaintext = 'CorrectHorseBatteryStaple!2026';
      const storedHash = await hashPassword(plaintext);

      const isMatch = await comparePassword(plaintext, storedHash);
      expect(isMatch).toBe(true);

      // Verify alias verifyPassword works identically
      const aliasMatch = await verifyPassword(plaintext, storedHash);
      expect(aliasMatch).toBe(true);
    });

    it('should return false when entered password does not match', async () => {
      const correctPassword = 'CorrectPassword#456';
      const wrongPassword = 'WrongPassword#456';
      const storedHash = await hashPassword(correctPassword);

      const isMatch = await comparePassword(wrongPassword, storedHash);
      expect(isMatch).toBe(false);
    });

    it('should be strictly case-sensitive', async () => {
      const password = 'CaseSensitivePassword$123';
      const storedHash = await hashPassword(password);

      const lowerMatch = await comparePassword(password.toLowerCase(), storedHash);
      expect(lowerMatch).toBe(false);

      const upperMatch = await comparePassword(password.toUpperCase(), storedHash);
      expect(upperMatch).toBe(false);
    });

    it('should safely return false without crashing on invalid inputs or malformed hashes', async () => {
      expect(await comparePassword('', 'somehash')).toBe(false);
      expect(await comparePassword('password', '')).toBe(false);
      expect(await comparePassword('password', 'malformed_invalid_hash_string')).toBe(false);
      expect(await comparePassword(null as any, 'somehash')).toBe(false);
      expect(await comparePassword('password', null as any)).toBe(false);
    });
  });

  describe('3. End-to-End Simulation: Password -> Hash -> Database -> Compare -> true/false', () => {
    it('should simulate full storage in user record and subsequent comparison', async () => {
      // 1. Password input from user
      const rawUserPassword = 'KashviMLM@Enterprise#2026';

      // 2. Hash password server-side
      const passwordHash = await hashPassword(rawUserPassword);

      // 3. Simulated User entity stored in database
      const dbUserRecord = {
        id: 'usr-uuid-test-001',
        email: 'distributor.test@kashvimlm.com',
        fullName: 'Test Distributor',
        roleName: 'DISTRIBUTOR',
        status: 'ACTIVE',
        passwordHash, // ONLY hash is stored, NEVER plaintext
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Invariant: database record MUST NOT contain plaintext password
      expect((dbUserRecord as any).password).toBeUndefined();
      expect(dbUserRecord.passwordHash).not.toBe(rawUserPassword);
      expect(dbUserRecord.passwordHash.startsWith('$argon2id$')).toBe(true);

      // 4. Compare entered password on future login attempt
      const correctLoginAttempt = 'KashviMLM@Enterprise#2026';
      const isCorrectMatch = await comparePassword(correctLoginAttempt, dbUserRecord.passwordHash);
      expect(isCorrectMatch).toBe(true);

      const wrongLoginAttempt = 'WrongPassword@999';
      const isWrongMatch = await comparePassword(wrongLoginAttempt, dbUserRecord.passwordHash);
      expect(isWrongMatch).toBe(false);
    });
  });

  describe('4. API Sanitization & Credential Protection', () => {
    it('should strip passwordHash and secret hashes from user response before sending to frontend', () => {
      const userFromDb = {
        id: 'usr-12345',
        userId: 'KV-1001',
        fullName: 'Rahul Sharma',
        email: 'rahul@kashvimlm.com',
        phone: '+919876543210',
        referralCode: 'DST-10001',
        sponsorId: 'KV-ROOT',
        status: 'ACTIVE',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$secretHashStringHere',
        securityPinHash: '$argon2id$v=19$m=65536,t=3,p=1$secretPinStringHere',
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      };

      const sanitized = sanitizeUserResponse(userFromDb);

      expect((sanitized as any).passwordHash).toBeUndefined();
      expect((sanitized as any).securityPinHash).toBeUndefined();
      expect((sanitized as any).twoFactorSecret).toBeUndefined();

      expect(sanitized.id).toBe('usr-12345');
      expect(sanitized.email).toBe('rahul@kashvimlm.com');
      expect(sanitized.referralCode).toBe('DST-10001');
      expect(sanitized.fullName).toBe('Rahul Sharma');
    });
  });

  describe('5. Password Strength Validation', () => {
    it('should accept strong compliant passwords', () => {
      const validPasswords = [
        'SecurePassword@123',
        'Kashvi#Enterprise2026',
        'StrongP@ssw0rd!',
        'Complex&P4ssword',
      ];

      for (const pw of validPasswords) {
        const result = validatePasswordStrength(pw);
        expect(result.isValid).toBe(true);
        expect(result.message).toBeUndefined();
      }
    });

    it('should reject passwords that fail security criteria', () => {
      // Too short (< 8)
      expect(validatePasswordStrength('Short1!').isValid).toBe(false);

      // Missing uppercase
      expect(validatePasswordStrength('lowercaseonly123!').isValid).toBe(false);

      // Missing lowercase
      expect(validatePasswordStrength('UPPERCASEONLY123!').isValid).toBe(false);

      // Missing digit
      expect(validatePasswordStrength('NoDigitsHereSpecial!').isValid).toBe(false);

      // Missing special character
      expect(validatePasswordStrength('NoSpecialChar1234').isValid).toBe(false);
    });
  });
});
