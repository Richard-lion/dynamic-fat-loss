/**
 * In-memory data store with Upstash Redis persistence.
 * Data survives deployments and cold starts.
 */
import * as fs from 'fs';
import { parseToken } from './auth';
import redis from './kv';

export interface User {
  id: string;
  gender: 'male' | 'female';
  workoutLevel: string;
  totalDurationDays: number;
  startDate: string;
  createdAt: string;
}

export interface DailyLog {
  date: string;
  weight: number | null;
  foods: FoodLogEntry[];
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
  totalSodium: number;
  calories: number;
}

export interface FoodLogEntry {
  id: string;
  name: string;
  weight: number;
  carbs: number;
  protein: number;
  fat: number;
  sodium: number;
  calories: number;
  meal: string;
  timestamp: string;
}

export interface CycleState {
  cycleNumber: number;
  startDayIndex: number;
  startWeight: number;
  baseWeight: number;
  carbModifier: number;
  targetCarbs: number;
  targetProtein: number;
  targetFat: number;
  targetCalories: number;
  settled: boolean;
}

export interface UserState {
  user: User | null;
  currentWeight: number;
  dailyLogs: Record<string, DailyLog>;
  cycleState: CycleState | null;
  targets: { carbs: number; protein: number; fat: number; calories: number } | null;
}

const LOCAL_DATA_DIR = '/tmp/fatloss_users';

// ── Local fallback for dev without Redis ────────────────────────

function getLocalUserFile(userId: string): string {
  return `${LOCAL_DATA_DIR}/user_${userId}.json`;
}

function ensureLocalDir(): void {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
}

function readLocalUserState(userId: string): UserState {
  ensureLocalDir();
  const file = getLocalUserFile(userId);
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.error('[store] Failed to read local user state:', e);
  }
  return { user: null, currentWeight: 0, dailyLogs: {}, cycleState: null, targets: null };
}

function writeLocalUserState(userId: string, state: UserState): void {
  ensureLocalDir();
  const file = getLocalUserFile(userId);
  try {
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[store] Failed to write local user state:', e);
  }
}

function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// ── In-memory cache (resets on cold start, but writes go to Redis) ─

const memoryCache: Record<string, UserState> = {};

export function getUserState(userId: string): UserState {
  if (isRedisConfigured()) {
    if (!(userId in memoryCache)) {
      // Sync read from Redis not possible here — caller must use getUserStateAsync
      // Return empty state as placeholder; actual data loaded async
      memoryCache[userId] = { user: null, currentWeight: 0, dailyLogs: {}, cycleState: null, targets: null };
    }
    return memoryCache[userId];
  }
  return readLocalUserState(userId);
}

export function setUserState(userId: string, state: UserState): void {
  if (isRedisConfigured()) {
    memoryCache[userId] = state;
    return;
  }
  writeLocalUserState(userId, state);
}

// ── Async versions (for API routes) ─────────────────────────────

export async function getUserStateAsync(userId: string): Promise<UserState> {
  if (isRedisConfigured()) {
    try {
      const raw = await redis.get<string>(`user:${userId}`);
      if (raw) {
        const state = JSON.parse(raw) as UserState;
        memoryCache[userId] = state;
        return state;
      }
    } catch (e) {
      console.error('[store] Redis read error:', e);
    }
    return { user: null, currentWeight: 0, dailyLogs: {}, cycleState: null, targets: null };
  }
  return readLocalUserState(userId);
}

export async function setUserStateAsync(userId: string, state: UserState): Promise<void> {
  memoryCache[userId] = state;
  if (isRedisConfigured()) {
    try {
      await redis.set(`user:${userId}`, JSON.stringify(state));
    } catch (e) {
      console.error('[store] Redis write error:', e);
    }
  } else {
    writeLocalUserState(userId, state);
  }
}

export { parseToken };

export function getUserIdFromRequest(request: Request): string | null {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const parsed = parseToken(token);
    return parsed?.userId ?? null;
  }
  return null;
}

// ── Food database ────────────────────────────────────────────────

export const FOODS = [
  { id: 1, name: '白米饭', carbs: 28, protein: 2.5, fat: 0.3, sodium: 1, unit: 'g', per: 100 },
  { id: 2, name: '糙米饭', carbs: 26, protein: 2.6, fat: 0.8, sodium: 2, unit: 'g', per: 100 },
  { id: 3, name: '鸡胸肉', carbs: 0, protein: 31, fat: 1.2, sodium: 45, unit: 'g', per: 100 },
  { id: 4, name: '牛腱肉', carbs: 0, protein: 29, fat: 4, sodium: 48, unit: 'g', per: 100 },
  { id: 5, name: '三文鱼', carbs: 0, protein: 25, fat: 8, sodium: 36, unit: 'g', per: 100 },
  { id: 6, name: '鸡蛋', carbs: 0.5, protein: 13, fat: 11, sodium: 71, unit: '个', per: 50 },
  { id: 7, name: '红薯', carbs: 20, protein: 1, fat: 0, sodium: 2, unit: 'g', per: 100 },
  { id: 8, name: '土豆', carbs: 17, protein: 2, fat: 0, sodium: 3, unit: 'g', per: 100 },
  { id: 9, name: '香蕉', carbs: 23, protein: 1.3, fat: 0.4, sodium: 1, unit: '根', per: 120 },
  { id: 10, name: '苹果', carbs: 14, protein: 0.3, fat: 0.2, sodium: 1, unit: '个', per: 200 },
  { id: 11, name: '西兰花', carbs: 4, protein: 2.8, fat: 0.4, sodium: 3, unit: 'g', per: 100 },
  { id: 12, name: '菠菜', carbs: 0.4, protein: 2.9, fat: 0.4, sodium: 7, unit: 'g', per: 100 },
  { id: 13, name: '奇异果', carbs: 15, protein: 1.3, fat: 0.5, sodium: 3, unit: '个', per: 75 },
  { id: 14, name: '希腊酸奶', carbs: 4, protein: 10, fat: 0.4, sodium: 36, unit: 'g', per: 100 },
  { id: 15, name: '毛豆', carbs: 5, protein: 8, fat: 3, sodium: 1, unit: 'g', per: 100 },
  { id: 16, name: '杏仁', carbs: 6, protein: 20, fat: 50, sodium: 0, unit: 'g', per: 28 },
  { id: 17, name: '鸡肉肠', carbs: 2, protein: 14, fat: 15, sodium: 480, unit: '条', per: 50 },
  { id: 18, name: '豆腐', carbs: 2, protein: 8, fat: 3, sodium: 4, unit: 'g', per: 100 },
  { id: 19, name: '鲜奶', carbs: 5, protein: 3.3, fat: 1.7, sodium: 43, unit: 'ml', per: 100 },
  { id: 20, name: '豆浆', carbs: 1.8, protein: 3.2, fat: 1.6, sodium: 3, unit: 'ml', per: 100 },
  { id: 21, name: '燕麦片', carbs: 60, protein: 12, fat: 6, sodium: 2, unit: 'g', per: 100 },
  { id: 22, name: '全麦吐司', carbs: 43, protein: 9, fat: 3, sodium: 400, unit: '片', per: 30 },
  { id: 23, name: '牛油果', carbs: 9, protein: 2, fat: 15, sodium: 7, unit: '个', per: 150 },
  { id: 24, name: '黑咖啡', carbs: 0, protein: 0.3, fat: 0, sodium: 2, unit: '杯', per: 240 },
  { id: 25, name: '绿茶', carbs: 0, protein: 0, fat: 0, sodium: 1, unit: '杯', per: 240 },
];
