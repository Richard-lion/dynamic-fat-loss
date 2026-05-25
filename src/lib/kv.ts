/**
 * Upstash Redis — persistent key-value store for Vercel Serverless
 * Data survives deployments and cold starts.
 *
 * Uses native fetch() to call Upstash REST API — no SDK, no npm deps needed.
 *
 * Setup:
 * 1. Sign up at https://upstash.com (or use https://upstash.com/start-redis for a temp DB)
 * 2. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * 3. Add them as Environment Variables in Vercel project settings
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// ── REST API helpers ───────────────────────────────────────────────

async function redisCmd<T = any>(...args: string[]): Promise<T> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('Upstash credentials not configured');
  }
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redis error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.result as T;
}

// ── Account helpers ────────────────────────────────────────────────

export async function kvGetAccounts(): Promise<Record<string, any>> {
  try {
    const raw = await redisCmd<string>('GET', 'accounts');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  } catch {
    return {};
  }
}

export async function kvSetAccounts(accounts: Record<string, any>): Promise<void> {
  await redisCmd('SET', 'accounts', JSON.stringify(accounts));
}

export async function kvGetUser(userId: string): Promise<any | null> {
  try {
    const raw = await redisCmd<string>('GET', `user:${userId}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  } catch {
    return null;
  }
}

export async function kvSetUser(userId: string, data: any): Promise<void> {
  await redisCmd('SET', `user:${userId}`, JSON.stringify(data));
}

export async function kvDelUser(userId: string): Promise<void> {
  await redisCmd('DEL', `user:${userId}`);
}

// ── Migration from /tmp filesystem ──────────────────────────────

export async function migrateFromTmp(): Promise<{ accounts: number; users: number }> {
  try {
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
  } catch {
    return { accounts: 0, users: 0 };
  }
}
