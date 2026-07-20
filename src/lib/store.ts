/**
 * In-memory data store with Upstash Redis persistence.
 * Data survives deployments and cold starts.
 */
import * as fs from 'fs';
import { parseToken } from './auth';
import { kvGetUser, kvSetUser } from './kv';

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

export interface FavoriteFood {
  id: string;
  name: string;
  weight: number;
  carbs: number;
  protein: number;
  fat: number;
  sodium: number;
  calories: number;
  unit: string;
  per: number;
  createdAt: string;
}

export interface UserState {
  user: User | null;
  currentWeight: number;
  dailyLogs: Record<string, DailyLog>;
  cycleState: CycleState | null;
  targets: { carbs: number; protein: number; fat: number; calories: number } | null;
  favorites: FavoriteFood[];
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
  return { user: null, currentWeight: 0, dailyLogs: {}, cycleState: null, targets: null, favorites: [] };
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
      memoryCache[userId] = { user: null, currentWeight: 0, dailyLogs: {}, cycleState: null, targets: null, favorites: [] };
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
    const state = await kvGetUser(userId);
    if (state) {
      memoryCache[userId] = state;
      return state;
    }
    return { user: null, currentWeight: 0, dailyLogs: {}, cycleState: null, targets: null, favorites: [] };
  }
  return readLocalUserState(userId);
}

export async function setUserStateAsync(userId: string, state: UserState): Promise<void> {
  memoryCache[userId] = state;
  if (isRedisConfigured()) {
    await kvSetUser(userId, state);
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

export interface Food {
  id: number;
  name: string;
  carbs: number;      // g per `per` unit
  protein: number;
  fat: number;
  sodium: number;     // mg per `per` unit
  unit: string;       // 'g' | 'ml' | '个' | '片' | '根' | '杯' | '条' ...
  per: number;        // unit quantity the macros apply to
  category: 'staple' | 'protein' | 'veg' | 'fruit' | 'dairy' | 'fat' | 'snack' | 'drink' | 'grain';
  keywords?: string;  // extra search terms (pinyin / en / alias)
}

export const FOOD_CATEGORIES: Record<Food['category'], string> = {
  staple: '主食',
  protein: '蛋白',
  veg: '蔬菜',
  fruit: '水果',
  dairy: '乳制品',
  fat: '坚果油脂',
  snack: '零食',
  drink: '饮品',
  grain: '杂粮',
};

export const FOODS: Food[] = [
  // ── 主食 staple ──
  { id: 1,  name: '白米饭',       carbs: 28,  protein: 2.5, fat: 0.3, sodium: 1,   unit: 'g', per: 100, category: 'staple', keywords: 'rice bai mi fan' },
  { id: 2,  name: '糙米饭',       carbs: 26,  protein: 2.6, fat: 0.8, sodium: 2,   unit: 'g', per: 100, category: 'staple', keywords: 'brown rice cao mi' },
  { id: 26, name: '小米粥',       carbs: 8.4, protein: 1.4, fat: 0.7, sodium: 4,   unit: 'g', per: 100, category: 'staple', keywords: 'millet xiao mi zhou' },
  { id: 27, name: '玉米',         carbs: 22,  protein: 4,   fat: 1.2, sodium: 1,   unit: 'g', per: 100, category: 'staple', keywords: 'corn yu mi' },
  { id: 28, name: '全麦面包',     carbs: 43,  protein: 9,   fat: 3,   sodium: 400, unit: '片', per: 30, category: 'staple', keywords: 'whole wheat bread quan mai mian bao' },
  { id: 22, name: '全麦吐司',     carbs: 43,  protein: 9,   fat: 3,   sodium: 400, unit: '片', per: 30, category: 'staple', keywords: 'toast quan mai tu si' },
  { id: 29, name: '馒头',         carbs: 47,  protein: 7,   fat: 1.1, sodium: 165, unit: 'g', per: 100, category: 'staple', keywords: 'mantou steamed bun' },
  { id: 30, name: '面条(煮)',     carbs: 24,  protein: 4.5, fat: 0.6, sodium: 4,   unit: 'g', per: 100, category: 'staple', keywords: 'noodles mian tiao' },
  { id: 31, name: '意大利面(煮)', carbs: 25,  protein: 5,   fat: 0.9, sodium: 1,   unit: 'g', per: 100, category: 'staple', keywords: 'pasta spaghetti yi da li mian' },
  { id: 32, name: '紫薯',         carbs: 20,  protein: 1.6, fat: 0.1, sodium: 8,   unit: 'g', per: 100, category: 'staple', keywords: 'purple sweet potato zi shu' },
  { id: 7,  name: '红薯',         carbs: 20,  protein: 1,   fat: 0,   sodium: 2,   unit: 'g', per: 100, category: 'staple', keywords: 'sweet potato hong shu' },
  { id: 8,  name: '土豆',         carbs: 17,  protein: 2,   fat: 0,   sodium: 3,   unit: 'g', per: 100, category: 'staple', keywords: 'potato tu dou' },
  { id: 33, name: '山药',         carbs: 12,  protein: 1.9, fat: 0.2, sodium: 5,   unit: 'g', per: 100, category: 'staple', keywords: 'yam shan yao' },
  { id: 34, name: '南瓜',         carbs: 7,   protein: 1,   fat: 0.1, sodium: 1,   unit: 'g', per: 100, category: 'staple', keywords: 'pumpkin nan gua' },
  { id: 35, name: '藜麦(煮)',     carbs: 21,  protein: 4.4, fat: 1.9, sodium: 7,   unit: 'g', per: 100, category: 'grain', keywords: 'quinoa li mai' },
  { id: 21, name: '燕麦片',       carbs: 60,  protein: 12,  fat: 6,   sodium: 2,   unit: 'g', per: 100, category: 'grain', keywords: 'oats yan mai' },
  { id: 36, name: '糙米',         carbs: 77,  protein: 7.9, fat: 2.7, sodium: 5,   unit: 'g', per: 100, category: 'grain', keywords: 'brown rice cao mi raw' },
  { id: 37, name: '黑米',         carbs: 75,  protein: 8.5, fat: 2.5, sodium: 6,   unit: 'g', per: 100, category: 'grain', keywords: 'black rice hei mi' },
  { id: 38, name: '红米',         carbs: 76,  protein: 7.8, fat: 2.6, sodium: 4,   unit: 'g', per: 100, category: 'grain', keywords: 'red rice hong mi' },
  { id: 39, name: '薏仁',         carbs: 71,  protein: 12,  fat: 3,   sodium: 5,   unit: 'g', per: 100, category: 'grain', keywords: 'job tears yi ren' },
  { id: 40, name: '荞麦面',       carbs: 70,  protein: 13,  fat: 3,   sodium: 11,  unit: 'g', per: 100, category: 'grain', keywords: 'buckwheat soba qiao mai' },

  // ── 蛋白 protein ──
  { id: 3,  name: '鸡胸肉',       carbs: 0,   protein: 31,  fat: 1.2, sodium: 45,  unit: 'g', per: 100, category: 'protein', keywords: 'chicken breast ji xiong rou' },
  { id: 41, name: '鸡腿肉(去皮)', carbs: 0,   protein: 26,  fat: 5,   sodium: 60,  unit: 'g', per: 100, category: 'protein', keywords: 'chicken thigh ji tui rou' },
  { id: 4,  name: '牛腱肉',       carbs: 0,   protein: 29,  fat: 4,   sodium: 48,  unit: 'g', per: 100, category: 'protein', keywords: 'beef shank niu jian rou' },
  { id: 42, name: '瘦牛肉',       carbs: 0,   protein: 26,  fat: 5,   sodium: 55,  unit: 'g', per: 100, category: 'protein', keywords: 'lean beef shou niu rou' },
  { id: 43, name: '猪里脊',       carbs: 0,   protein: 22,  fat: 6,   sodium: 45,  unit: 'g', per: 100, category: 'protein', keywords: 'pork tenderloin zhu li ji' },
  { id: 44, name: '羊肉(瘦)',     carbs: 0,   protein: 25,  fat: 8,   sodium: 60,  unit: 'g', per: 100, category: 'protein', keywords: 'lamb yang rou' },
  { id: 5,  name: '三文鱼',       carbs: 0,   protein: 25,  fat: 8,   sodium: 36,  unit: 'g', per: 100, category: 'protein', keywords: 'salmon san wen yu' },
  { id: 45, name: '鳕鱼',         carbs: 0,   protein: 18,  fat: 0.7, sodium: 60,  unit: 'g', per: 100, category: 'protein', keywords: 'cod xue yu' },
  { id: 46, name: '金枪鱼(罐头)', carbs: 0,   protein: 24,  fat: 1,   sodium: 320, unit: 'g', per: 100, category: 'protein', keywords: 'tuna jin qiang yu' },
  { id: 47, name: '虾',           carbs: 0.2, protein: 24,  fat: 0.3, sodium: 119, unit: 'g', per: 100, category: 'protein', keywords: 'shrimp xia' },
  { id: 48, name: '三文鱼刺身',   carbs: 0,   protein: 25,  fat: 12,  sodium: 45,  unit: 'g', per: 100, category: 'protein', keywords: 'sashimi san wen yu ci shen' },
  { id: 49, name: '豆腐(北)',     carbs: 2,   protein: 12,  fat: 5,   sodium: 7,   unit: 'g', per: 100, category: 'protein', keywords: 'tofu dou fu' },
  { id: 18, name: '豆腐',         carbs: 2,   protein: 8,   fat: 3,   sodium: 4,   unit: 'g', per: 100, category: 'protein', keywords: 'tofu dou fu' },
  { id: 50, name: '豆干',         carbs: 4,   protein: 16,  fat: 8,   sodium: 320, unit: 'g', per: 100, category: 'protein', keywords: 'dried tofu dou gan' },
  { id: 51, name: '豆浆(无糖)',   carbs: 1.8, protein: 3.2, fat: 1.6, sodium: 3,   unit: 'ml', per: 100, category: 'protein', keywords: 'soy milk dou jiang' },
  { id: 20, name: '豆浆',         carbs: 1.8, protein: 3.2, fat: 1.6, sodium: 3,   unit: 'ml', per: 100, category: 'protein', keywords: 'soy milk dou jiang' },
  { id: 52, name: '鸡蛋(煮)',     carbs: 0.5, protein: 13,  fat: 11,  sodium: 71,  unit: '个', per: 50, category: 'protein', keywords: 'boiled egg ji dan' },
  { id: 6,  name: '鸡蛋',         carbs: 0.5, protein: 13,  fat: 11,  sodium: 71,  unit: '个', per: 50, category: 'protein', keywords: 'egg ji dan' },
  { id: 53, name: '蛋白粉(1勺)',  carbs: 3,   protein: 24,  fat: 1.5, sodium: 60,  unit: '勺', per: 30, category: 'protein', keywords: 'whey protein dan bai fen' },
  { id: 54, name: '火鸡胸肉',     carbs: 0,   protein: 29,  fat: 1.5, sodium: 50,  unit: 'g', per: 100, category: 'protein', keywords: 'turkey breast huo ji xiong rou' },

  // ── 蔬菜 veg ──
  { id: 11, name: '西兰花',       carbs: 4,   protein: 2.8, fat: 0.4, sodium: 3,   unit: 'g', per: 100, category: 'veg', keywords: 'broccoli xi lan hua' },
  { id: 12, name: '菠菜',         carbs: 0.4, protein: 2.9, fat: 0.4, sodium: 7,   unit: 'g', per: 100, category: 'veg', keywords: 'spinach bo cai' },
  { id: 55, name: '生菜',         carbs: 1.4, protein: 1.4, fat: 0.2, sodium: 10,  unit: 'g', per: 100, category: 'veg', keywords: 'lettuce sheng cai' },
  { id: 56, name: '黄瓜',         carbs: 3.6, protein: 0.7, fat: 0.1, sodium: 2,   unit: 'g', per: 100, category: 'veg', keywords: 'cucumber huang gua' },
  { id: 57, name: '番茄',         carbs: 3.9, protein: 0.9, fat: 0.2, sodium: 5,   unit: 'g', per: 100, category: 'veg', keywords: 'tomato fan qie' },
  { id: 58, name: '胡萝卜',       carbs: 10,  protein: 0.9, fat: 0.2, sodium: 69,  unit: 'g', per: 100, category: 'veg', keywords: 'carrot hu luo bo' },
  { id: 59, name: '芦笋',         carbs: 3.9, protein: 2.2, fat: 0.1, sodium: 2,   unit: 'g', per: 100, category: 'veg', keywords: 'asparagus lu sun' },
  { id: 60, name: '甜椒',         carbs: 6,   protein: 1,   fat: 0.3, sodium: 4,   unit: 'g', per: 100, category: 'veg', keywords: 'bell pepper tian jiao' },
  { id: 61, name: '蘑菇',         carbs: 3.3, protein: 3.1, fat: 0.3, sodium: 5,   unit: 'g', per: 100, category: 'veg', keywords: 'mushroom mo gu' },
  { id: 62, name: '花椰菜',       carbs: 5,   protein: 1.9, fat: 0.3, sodium: 30,  unit: 'g', per: 100, category: 'veg', keywords: 'cauliflower hua ye cai' },
  { id: 63, name: '芹菜',         carbs: 3,   protein: 0.7, fat: 0.2, sodium: 80,  unit: 'g', per: 100, category: 'veg', keywords: 'celery qin cai' },
  { id: 64, name: '洋葱',         carbs: 9,   protein: 1.1, fat: 0.1, sodium: 4,   unit: 'g', per: 100, category: 'veg', keywords: 'onion yang cong' },
  { id: 65, name: '蒜',           carbs: 33,  protein: 6.4, fat: 0.5, sodium: 17,  unit: 'g', per: 100, category: 'veg', keywords: 'garlic suan' },
  { id: 66, name: '豆芽',         carbs: 4,   protein: 3,   fat: 0.2, sodium: 6,   unit: 'g', per: 100, category: 'veg', keywords: 'bean sprouts dou ya' },

  // ── 水果 fruit ──
  { id: 9,  name: '香蕉',         carbs: 23,  protein: 1.3, fat: 0.4, sodium: 1,   unit: '根', per: 120, category: 'fruit', keywords: 'banana xiang jiao' },
  { id: 10, name: '苹果',         carbs: 14,  protein: 0.3, fat: 0.2, sodium: 1,   unit: '个', per: 200, category: 'fruit', keywords: 'apple ping guo' },
  { id: 13, name: '奇异果',       carbs: 15,  protein: 1.3, fat: 0.5, sodium: 3,   unit: '个', per: 75, category: 'fruit', keywords: 'kiwi qi yi guo' },
  { id: 67, name: '橙子',         carbs: 12,  protein: 0.9, fat: 0.1, sodium: 0,   unit: '个', per: 150, category: 'fruit', keywords: 'orange cheng zi' },
  { id: 68, name: '蓝莓',         carbs: 14,  protein: 0.7, fat: 0.3, sodium: 1,   unit: 'g', per: 100, category: 'fruit', keywords: 'blueberry lan mei' },
  { id: 69, name: '草莓',         carbs: 8,   protein: 0.7, fat: 0.3, sodium: 1,   unit: 'g', per: 100, category: 'fruit', keywords: 'strawberry cao mei' },
  { id: 70, name: '葡萄',         carbs: 18,  protein: 0.7, fat: 0.2, sodium: 2,   unit: 'g', per: 100, category: 'fruit', keywords: 'grape pu tao' },
  { id: 71, name: '西瓜',         carbs: 8,   protein: 0.6, fat: 0.2, sodium: 1,   unit: 'g', per: 100, category: 'fruit', keywords: 'watermelon xi gua' },
  { id: 72, name: '芒果',         carbs: 15,  protein: 0.8, fat: 0.4, sodium: 1,   unit: 'g', per: 100, category: 'fruit', keywords: 'mango mang guo' },
  { id: 73, name: '牛油果',       carbs: 9,   protein: 2,   fat: 15,  sodium: 7,   unit: '个', per: 150, category: 'fruit', keywords: 'avocado niu you guo' },
  { id: 23, name: '牛油果',       carbs: 9,   protein: 2,   fat: 15,  sodium: 7,   unit: '个', per: 150, category: 'fruit', keywords: 'avocado niu you guo' },
  { id: 74, name: '梨',           carbs: 15,  protein: 0.4, fat: 0.1, sodium: 1,   unit: '个', per: 180, category: 'fruit', keywords: 'pear li' },
  { id: 75, name: '桃子',         carbs: 10,  protein: 0.9, fat: 0.3, sodium: 0,   unit: '个', per: 150, category: 'fruit', keywords: 'peach tao zi' },

  // ── 乳制品 dairy ──
  { id: 14, name: '希腊酸奶',     carbs: 4,   protein: 10,  fat: 0.4, sodium: 36,  unit: 'g', per: 100, category: 'dairy', keywords: 'greek yogurt xi la suan nai' },
  { id: 76, name: '酸奶(无糖)',   carbs: 5,   protein: 3.5, fat: 3,   sodium: 45,  unit: 'g', per: 100, category: 'dairy', keywords: 'yogurt suan nai' },
  { id: 19, name: '鲜奶',         carbs: 5,   protein: 3.3, fat: 1.7, sodium: 43,  unit: 'ml', per: 100, category: 'dairy', keywords: 'milk xian nai' },
  { id: 77, name: '脱脂牛奶',     carbs: 5,   protein: 3.4, fat: 0.1, sodium: 42,  unit: 'ml', per: 100, category: 'dairy', keywords: 'skim milk tuo zhi niu nai' },
  { id: 78, name: '奶酪(低脂)',   carbs: 2,   protein: 25,  fat: 10,  sodium: 620, unit: 'g', per: 100, category: 'dairy', keywords: 'cheese nai lao' },
  { id: 79, name: '豆浆(甜)',     carbs: 8,   protein: 3,   fat: 1.6, sodium: 5,   unit: 'ml', per: 100, category: 'dairy', keywords: 'sweet soy milk tian dou jiang' },

  // ── 坚果油脂 fat ──
  { id: 16, name: '杏仁',         carbs: 6,   protein: 20,  fat: 50,  sodium: 0,   unit: 'g', per: 28, category: 'fat', keywords: 'almonds xing ren' },
  { id: 80, name: '核桃',         carbs: 4,   protein: 15,  fat: 65,  sodium: 2,   unit: 'g', per: 28, category: 'fat', keywords: 'walnuts he tao' },
  { id: 81, name: '腰果',         carbs: 9,   protein: 18,  fat: 44,  sodium: 3,   unit: 'g', per: 28, category: 'fat', keywords: 'cashews yao guo' },
  { id: 82, name: '花生',         carbs: 6,   protein: 26,  fat: 49,  sodium: 5,   unit: 'g', per: 28, category: 'fat', keywords: 'peanuts hua sheng' },
  { id: 83, name: '橄榄油',       carbs: 0,   protein: 0,   fat: 100, sodium: 2,   unit: 'ml', per: 10, category: 'fat', keywords: 'olive oil gan lan you' },
  { id: 84, name: '亚麻籽油',     carbs: 0,   protein: 0,   fat: 100, sodium: 0,   unit: 'ml', per: 10, category: 'fat', keywords: 'flaxseed oil ya ma zi you' },
  { id: 85, name: '奇亚籽',       carbs: 7,   protein: 17,  fat: 31,  sodium: 16,  unit: 'g', per: 28, category: 'fat', keywords: 'chia seeds qi ya zi' },

  // ── 零食 snack ──
  { id: 17, name: '鸡肉肠',       carbs: 2,   protein: 14,  fat: 15,  sodium: 480, unit: '条', per: 50, category: 'snack', keywords: 'chicken sausage ji rou chang' },
  { id: 86, name: '黑巧克力(85%)',carbs: 22,  protein: 8,   fat: 46,  sodium: 20,  unit: 'g', per: 100, category: 'snack', keywords: 'dark chocolate hei qiao ke li' },
  { id: 87, name: '全麦饼干',     carbs: 65,  protein: 7,   fat: 15,  sodium: 350, unit: 'g', per: 100, category: 'snack', keywords: 'whole wheat biscuit quan mai bing gan' },
  { id: 88, name: '海苔',         carbs: 4,   protein: 30,  fat: 3,   sodium: 220, unit: 'g', per: 100, category: 'snack', keywords: 'seaweed hai tai' },

  // ── 饮品 drink ──
  { id: 24, name: '黑咖啡',       carbs: 0,   protein: 0.3, fat: 0,   sodium: 2,   unit: '杯', per: 240, category: 'drink', keywords: 'black coffee hei ka fei' },
  { id: 25, name: '绿茶',         carbs: 0,   protein: 0,   fat: 0,   sodium: 1,   unit: '杯', per: 240, category: 'drink', keywords: 'green tea lv cha' },
  { id: 89, name: '无糖气泡水',   carbs: 0,   protein: 0,   fat: 0,   sodium: 0,   unit: '杯', per: 330, category: 'drink', keywords: 'sparkling water wu tang qi pao shui' },
  { id: 90, name: '椰子水',       carbs: 4,   protein: 0.7, fat: 0.2, sodium: 105, unit: 'ml', per: 100, category: 'drink', keywords: 'coconut water ye zi shui' },
];
