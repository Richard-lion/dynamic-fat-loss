// Auth utilities: password hashing + token verification
import * as crypto from 'crypto';

const SALT_LEN = 16;
const KEY_LEN = 64;
const ITERATIONS = 100000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const calc = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calc));
}

// Simple token: base64(userId:expiryMs)
export function makeToken(userId: string, ttlMs = 30 * 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  return Buffer.from(`${userId}:${exp}`).toString('base64');
}

export function parseToken(token: string): { userId: string; exp: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, expStr] = decoded.split(':');
    const exp = parseInt(expStr, 10);
    if (!userId || !exp || Date.now() > exp) return null;
    return { userId, exp };
  } catch {
    return null;
  }
}