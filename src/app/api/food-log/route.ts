import { NextRequest, NextResponse } from 'next/server';
import { getUserStateAsync, setUserStateAsync, getUserIdFromRequest, type FoodLogEntry } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const state = await getUserStateAsync(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    return NextResponse.json({ foods: state.dailyLogs[today]?.foods || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const { name, weight, carbs, protein, fat, sodium, calories, meal } = await req.json();
    if (!name || !weight || !meal) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }

    const state = await getUserStateAsync(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    if (!state.dailyLogs[today]) {
      state.dailyLogs[today] = {
        date: today, weight: null, foods: [],
        totalCarbs: 0, totalProtein: 0, totalFat: 0, totalSodium: 0, calories: 0,
      };
    }

    const entry: FoodLogEntry = {
      id: crypto.randomUUID(), name, weight,
      carbs: Math.round(carbs || 0),
      protein: Math.round(protein || 0),
      fat: Math.round(fat || 0),
      sodium: Math.round(sodium || 0),
      calories: Math.round(calories || 0),
      meal, timestamp: new Date().toISOString(),
    };

    state.dailyLogs[today].foods.push(entry);
    state.dailyLogs[today].totalCarbs += entry.carbs;
    state.dailyLogs[today].totalProtein += entry.protein;
    state.dailyLogs[today].totalFat += entry.fat;
    state.dailyLogs[today].totalSodium += entry.sodium;
    state.dailyLogs[today].calories += entry.calories;

    await setUserStateAsync(userId, state);
    return NextResponse.json({ success: true, entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

    const state = await getUserStateAsync(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    const log = state.dailyLogs[today];
    if (!log) return NextResponse.json({ error: '找不到今日记录' }, { status: 404 });

    const idx = log.foods.findIndex((f: FoodLogEntry) => f.id === id);
    if (idx === -1) return NextResponse.json({ error: '找不到食物' }, { status: 404 });

    const [removed] = log.foods.splice(idx, 1);
    log.totalCarbs -= removed.carbs;
    log.totalProtein -= removed.protein;
    log.totalFat -= removed.fat;
    log.totalSodium -= removed.sodium;
    log.calories -= removed.calories;

    await setUserStateAsync(userId, state);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
