/**
 * Upstash Redis — persistent key-value store for Vercel Serverless
 * Data survives deployments and cold starts.
 *
 * Setup:
 * 1. Sign up at https://upstash.com and create a Redis database
 * 2. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * 3. Add them as Environment Variables in Vercel project settings
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default redis;

// ── Account helpers ──────────────────────────────────────────────

export async function kvGetAccounts(): Promise<Record<string, any>> {
  const raw = await redis.get<string>('accounts');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function kvSetAccounts(accounts: Record<string, any>): Promise<void> {
  await redis.set('accounts', JSON.stringify(accounts));
}

export async function kvGetUser(userId: string): Promise<any | null> {
  const raw = await redis.get<string>(`user:${userId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function kvSetUser(userId: string, data: any): Promise<void> {
  await redis.set(`user:${userId}`, JSON.stringify(data));
}

// ── Migration from /tmp filesystem ──────────────────────────────

export async function migrateFromTmp(): Promise<{ accounts: number; users: number }> {
  const fs = await import('fs');
  const path = await import('path');

  const accDir = '/tmp/fatloss_users';
  if (!fs.existsSync(accDir)) return { accounts: 0, users: 0 };

  // Migrate accounts
  const accFile = path.join(accDir, 'accounts.json');
  let accountsMigrated = 0;
  if (fs.existsSync(accFile)) {
    const accounts = JSON.parse(fs.readFileSync(accFile, 'utf-8'));
    await kvSetAccounts(accounts);
    accountsMigrated = Object.keys(accounts).length;
  }

  // Migrate user files
  let usersMigrated = 0;
  const files = fs.readdirSync(accDir);
  for (const file of files) {
    if (file.startsWith('user_') && file.endsWith('.json')) {
      const userId = file.replace('user_', '').replace('.json', '');
      const data = JSON.parse(fs.readFileSync(path.join(accDir, file), 'utf-8'));
      await kvSetUser(userId, data);
      usersMigrated++;
    }
  }

  return { accounts: accountsMigrated, users: usersMigrated };
}
