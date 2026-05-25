import { NextRequest, NextResponse } from 'next/server';
import { getUserState, getUserIdFromRequest } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const state = getUserState(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    // Build weight history
    const weightData: Array<{ date: string; weight: number; movingAvg: number }> = [];
    const dates = Object.keys(state.dailyLogs).sort();

    let sum = 0;
    for (let i = 0; i < dates.length; i++) {
      const log = state.dailyLogs[dates[i]];
      if (log.weight !== null) {
        sum += log.weight;
        const avg = sum / (i + 1);
        weightData.push({ date: dates[i], weight: log.weight, movingAvg: Math.round(avg * 10) / 10 });
      }
    }

    // Macro totals (last 7 days)
    const recentLogs = dates.slice(-7).map(d => state.dailyLogs[d]);
    const macroTotal = recentLogs.reduce(
      (acc, log) => ({
        carbs: acc.carbs + log.totalCarbs,
        protein: acc.protein + log.totalProtein,
        fat: acc.fat + log.totalFat,
        calories: acc.calories + log.calories,
      }),
      { carbs: 0, protein: 0, fat: 0, calories: 0 }
    );

    const carbCals = macroTotal.carbs * 4;
    const proteinCals = macroTotal.protein * 4;
    const fatCals = macroTotal.fat * 9;
    const totalCals = carbCals + proteinCals + fatCals || 1;

    return NextResponse.json({
      weightData,
      macroTotal,
      macroPercentages: {
        carbs: Math.round((carbCals / totalCals) * 100),
        protein: Math.round((proteinCals / totalCals) * 100),
        fat: Math.round((fatCals / totalCals) * 100),
      },
      startWeight: state.cycleState?.startWeight || state.currentWeight,
      currentWeight: state.currentWeight,
      totalDays: state.user.totalDurationDays,
      daysLogged: dates.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}