/**
 * User account registry: username -> { passwordHash, userId, createdAt }
 * Uses Upstash Redis (production) or local filesystem (local dev).
 */
import * as fs from 'fs';
import path from 'path';
import redis from '@/lib/kv';

export interface Account {
  passwordHash: string;
  userId: string;
  createdAt: string;
}

const LOCAL_ACC_FILE = '/tmp/fatloss_users/accounts.json';

function ensureLocalDir(): void {
  const dir = '/tmp/fatloss_users';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readLocalAccounts(): Record<string, Account> {
  ensureLocalDir();
  try {
    if (fs.existsSync(LOCAL_ACC_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_ACC_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[accounts] Failed to read local accounts:', e);
  }
  return {};
}

function writeLocalAccounts(accounts: Record<string, Account>): void {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_ACC_FILE, JSON.stringify(accounts, null, 2));
}

function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// ── Public API ──────────────────────────────────────────────────

export function getAllAccounts(): Record<string, Account> {
  if (isRedisConfigured()) return {} as Record<string, Account>; // won't be called
  return readLocalAccounts();
}

export function getAccountByUsername(username: string): Account | null {
  if (isRedisConfigured()) {
    // Synchronous fallback for TypeScript — actual call is async below
    return null;
  }
  const accounts = readLocalAccounts();
  return accounts[username] || null;
}

export function createAccount(username: string, passwordHash: string, userId: string): Account {
  const account: Account = { passwordHash, userId, createdAt: new Date().toISOString() };

  if (isRedisConfigured()) {
    // Handled async in route — this is a no-op for TypeScript
    return account;
  }

  const accounts = readLocalAccounts();
  accounts[username] = account;
  writeLocalAccounts(accounts);
  return account;
}

export function usernameExists(username: string): boolean {
  if (isRedisConfigured()) return false; // async check in route
  const accounts = readLocalAccounts();
  return username in accounts;
}

// ── Async versions (for routes) ──────────────────────────────────

export async function kvGetAccountByUsername(username: string): Promise<Account | null> {
  const accounts = await redisGetAllAccounts();
  return accounts[username] || null;
}

export async function kvCreateAccount(username: string, passwordHash: string, userId: string): Promise<Account> {
  const account: Account = { passwordHash, userId, createdAt: new Date().toISOString() };
  const accounts = await redisGetAllAccounts();
  accounts[username] = account;
  await redis.set('accounts', JSON.stringify(accounts));
  return account;
}

export async function kvUsernameExists(username: string): Promise<boolean> {
  const accounts = await redisGetAllAccounts();
  return username in accounts;
}

async function redisGetAllAccounts(): Promise<Record<string, Account>> {
  try {
    const raw = await redis.get<string>('accounts');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('[accounts] Redis read error, falling back to local:', e);
    return readLocalAccounts();
  }
}
