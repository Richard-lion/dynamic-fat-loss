import { NextRequest, NextResponse } from 'next/server';
import { getUserStateAsync, setUserStateAsync, getUserIdFromRequest } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const { weight } = await req.json();
    if (!weight || weight < 20 || weight > 300) {
      return NextResponse.json({ error: '体重数值不合理' }, { status: 400 });
    }

    const state = await getUserStateAsync(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    if (!state.dailyLogs[today]) {
      state.dailyLogs[today] = {
        date: today, weight, foods: [],
        totalCarbs: 0, totalProtein: 0, totalFat: 0, totalSodium: 0, calories: 0,
      };
    } else {
      state.dailyLogs[today].weight = weight;
    }
    state.currentWeight = weight;

    await setUserStateAsync(userId, state);
    return NextResponse.json({ success: true, weight });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
