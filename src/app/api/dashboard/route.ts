import { NextRequest, NextResponse } from 'next/server';
import { getUserStateAsync, setUserStateAsync, getUserIdFromRequest, FOODS } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    // Check Authorization header first
    const authHeader = req.headers.get('Authorization') || '';
    let userId: string | null = null;
    let tokenSource = '';

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const { parseToken } = await import('@/lib/auth');
      const parsed = parseToken(token);
      if (parsed) {
        userId = parsed.userId;
        tokenSource = 'header';
      }
    }

    // Fallback: check fl_token cookie
    if (!userId) {
      const cookieToken = req.cookies.get('fl_token')?.value;
      if (cookieToken) {
        const { parseToken } = await import('@/lib/auth');
        const parsed = parseToken(cookieToken);
        if (parsed) {
          userId = parsed.userId;
          tokenSource = 'cookie';
        }
      }
    }

    console.error('[dashboard] tokenSource:', tokenSource, 'userId:', userId);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const state = await getUserStateAsync(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(state.user.startDate);
    const todayDate = new Date(today);
    const dayIndex = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    let todayLog = state.dailyLogs[today];
    if (!todayLog) {
      todayLog = {
        date: today, weight: null, foods: [],
        totalCarbs: 0, totalProtein: 0, totalFat: 0, totalSodium: 0, calories: 0,
      };
      state.dailyLogs[today] = todayLog;
      // Auto-save new day
      await setUserStateAsync(userId, state);
    }

    const targets = state.targets || { carbs: 0, protein: 0, fat: 0, calories: 0 };
    const dayOfCycle = (dayIndex % 10) + 1;
    const daysLeftInCycle = 10 - dayOfCycle;
    const cycleNumber = Math.floor(dayIndex / 10) + 1;

    const sodiumMg = todayLog.totalSodium || 0;
    const sodiumPercent = Math.min((sodiumMg / 2300) * 100, 100);
    const sodiumColor = sodiumMg < 1800 ? 'orange' : sodiumMg < 2300 ? 'yellow' : 'red';

    return NextResponse.json({
      user: state.user, today,
      dayIndex: Math.max(0, dayIndex),
      dayOfCycle: Math.max(1, dayOfCycle),
      daysLeftInCycle: Math.max(0, daysLeftInCycle),
      cycleNumber: Math.max(1, cycleNumber),
      totalDays: state.user.totalDurationDays,
      weight: state.currentWeight,
      todayWeight: todayLog.weight,
      todayLog, targets,
      cycleState: state.cycleState,
      sodiumMg, sodiumPercent, sodiumColor,
      foodDatabase: FOODS,
      favorites: state.favorites || [],
    });
  } catch (e: any) {
    console.error('dashboard error:', e);
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
