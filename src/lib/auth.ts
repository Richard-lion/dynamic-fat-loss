// Auth utilities: password hashing + token verification
import * as crypto from 'crypto';

const SALT_LEN = 16;
const KEY_LEN = 64;
const ITERATIONS = 100000;

// HMAC secret — must match the secret used in store.ts for cookie signing
// In Vercel, set TOKEN_SECRET env var. Fallback to a build-id derived key for local dev.
function getHmacSecret(): Buffer {
  const secret = process.env.TOKEN_SECRET;
  if (secret) return Buffer.from(secret, 'utf8');
  // Fallback for dev: derive from nodejs build constants (not secure, but works locally)
  // This ensures local dev tokens work but production needs TOKEN_SECRET env var.
  return crypto.createHash('sha256').update('fat-loss-app-' + (process.env.NODE_BUILD_ID || 'dev')).digest();
}

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

// Token: HMAC-SHA256(userId:expiryMs, secret) → base64 for tamper resistance
export function makeToken(userId: string, ttlMs = 30 * 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const msg = `${userId}:${exp}`;
  const sig = crypto.createHmac('sha256', getHmacSecret()).update(msg).digest('base64');
  // Format: base64(userId:exp) + '.' + base64(signature)
  return Buffer.from(msg).toString('base64') + '.' + sig;
}

export function parseToken(token: string): { userId: string; exp: number } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    // Verify signature
    const expectedSig = crypto.createHmac('sha256', getHmacSecret())
      .update(Buffer.from(payload, 'base64').toString('utf8'))
      .digest('base64');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    const [userId, expStr] = decoded.split(':');
    const exp = parseInt(expStr, 10);
    if (!userId || !exp || Date.now() > exp) return null;
    return { userId, exp };
  } catch {
    return null;
  }
}