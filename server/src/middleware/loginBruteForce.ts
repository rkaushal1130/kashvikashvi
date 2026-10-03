/**
 * Brute-Force & Credential Stuffing Defense
 * Locks accounts/IPs temporarily after 5 consecutive failed login attempts
 */

interface FailedAttemptRecord {
  attempts: number;
  lockedUntil: number | null;
}

const attemptStore = new Map<string, FailedAttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function getKeys(username?: string, ip?: string): string[] {
  const keys: string[] = [];
  if (username) keys.push(`user:${username.toLowerCase().trim()}`);
  if (ip) keys.push(`ip:${ip.trim()}`);
  return keys;
}

export class LoginProtectionService {
  static checkAttemptStatus(username?: string, ip?: string): { isLocked: boolean; remainingSeconds: number } {
    const keys = getKeys(username, ip);
    const now = Date.now();

    for (const key of keys) {
      const record = attemptStore.get(key);
      if (record && record.lockedUntil && record.lockedUntil > now) {
        return {
          isLocked: true,
          remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
        };
      }
    }

    return { isLocked: false, remainingSeconds: 0 };
  }

  static recordFailedAttempt(username?: string, ip?: string): { attempts: number; isLocked: boolean } {
    const keys = getKeys(username, ip);
    const now = Date.now();
    let maxAttempts = 0;
    let locked = false;

    for (const key of keys) {
      const record = attemptStore.get(key) || { attempts: 0, lockedUntil: null };

      // If existing lock expired, reset
      if (record.lockedUntil && record.lockedUntil <= now) {
        record.attempts = 0;
        record.lockedUntil = null;
      }

      record.attempts += 1;

      if (record.attempts >= MAX_ATTEMPTS) {
        record.lockedUntil = now + LOCK_DURATION_MS;
        locked = true;
      }

      attemptStore.set(key, record);
      if (record.attempts > maxAttempts) maxAttempts = record.attempts;
    }

    return { attempts: maxAttempts, isLocked: locked };
  }

  static resetAttempts(username?: string, ip?: string): void {
    const keys = getKeys(username, ip);
    for (const key of keys) {
      attemptStore.delete(key);
    }
  }
}
