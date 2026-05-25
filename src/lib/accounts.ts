// User account registry: username -> { passwordHash, userId, createdAt }
// Lives in /tmp/fatloss_users/accounts.json
import fs from 'fs';
import path from 'path';

export interface Account {
  passwordHash: string;
  userId: string;
  createdAt: string;
}

const ACCOUNTS_FILE = '/tmp/fatloss_users/accounts.json';

function ensureAccountsDir(): void {
  const dir = '/tmp/fatloss_users';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getAllAccounts(): Record<string, Account> {
  ensureAccountsDir();
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load accounts:', e);
  }
  return {};
}

export function saveAccounts(accounts: Record<string, Account>): void {
  ensureAccountsDir();
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

export function getAccountByUsername(username: string): Account | null {
  const accounts = getAllAccounts();
  return accounts[username] || null;
}

export function createAccount(username: string, passwordHash: string, userId: string): Account {
  const accounts = getAllAccounts();
  const account: Account = { passwordHash, userId, createdAt: new Date().toISOString() };
  accounts[username] = account;
  saveAccounts(accounts);
  return account;
}

export function usernameExists(username: string): boolean {
  return username in getAllAccounts();
}