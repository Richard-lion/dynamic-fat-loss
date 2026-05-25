/**
 * User account registry: username -> { passwordHash, userId, createdAt }
 * Uses Upstash Redis (production) or local filesystem (local dev).
 */
import * as fs from 'fs';
import { kvGetAccounts, kvSetAccounts } from '@/lib/kv';

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

// ── Public API (sync — for local dev fallback) ─────────────────────

export function getAllAccounts(): Record<string, Account> {
  if (isRedisConfigured()) return {} as Record<string, Account>;
  return readLocalAccounts();
}

export function getAccountByUsername(username: string): Account | null {
  if (isRedisConfigured()) return null; // async version used in routes
  const accounts = readLocalAccounts();
  return accounts[username] || null;
}

export function createAccount(username: string, passwordHash: string, userId: string): Account {
  const account: Account = { passwordHash, userId, createdAt: new Date().toISOString() };
  if (isRedisConfigured()) return account; // async version used in routes
  const accounts = readLocalAccounts();
  accounts[username] = account;
  writeLocalAccounts(accounts);
  return account;
}

export function usernameExists(username: string): boolean {
  if (isRedisConfigured()) return false; // async version used in routes
  const accounts = readLocalAccounts();
  return username in accounts;
}

// ── Async versions (for routes) ─────────────────────────────────────

export async function kvGetAccountByUsername(username: string): Promise<Account | null> {
  const accounts = await kvGetAccounts();
  return accounts[username] || null;
}

export async function kvCreateAccount(username: string, passwordHash: string, userId: string): Promise<Account> {
  const account: Account = { passwordHash, userId, createdAt: new Date().toISOString() };
  const accounts = await kvGetAccounts();
  accounts[username] = account;
  await kvSetAccounts(accounts);
  return account;
}

export async function kvUsernameExists(username: string): Promise<boolean> {
  const accounts = await kvGetAccounts();
  return username in accounts;
}
