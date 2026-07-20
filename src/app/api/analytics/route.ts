import { NextRequest, NextResponse } from 'next/server';
import { getUserStateAsync, getUserIdFromRequest } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const state = await getUserStateAsync(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    const dates = Object.keys(state.dailyLogs).sort();
    const targets = state.targets || { carbs: 0, protein: 0, fat: 0, calories: 0 };

    // Build daily series + correct 7-day moving average (trailing window)
    const weightData: Array<{ date: string; weight: number; movingAvg: number }> = [];
    const dailySeries: Array<{
      date: string;
      weight: number | null;
      movingAvg: number | null;
      calories: number;
      carbs: number;
      protein: number;
      fat: number;
      targetCalories: number;
      targetCarbs: number;
      targetProtein: number;
      targetFat: number;
    }> = [];

    const weightOnly: number[] = [];
    for (const d of dates) {
      const log = state.dailyLogs[d];
      if (log.weight !== null && log.weight !== undefined) weightOnly.push(log.weight);
      const window = weightOnly.slice(-7);
      const movingAvg = window.length > 0
        ? Math.round((window.reduce((s, w) => s + w, 0) / window.length) * 10) / 10
        : null;

      if (log.weight !== null && log.weight !== undefined) {
        weightData.push({ date: d, weight: log.weight, movingAvg: movingAvg! });
      }

      dailySeries.push({
        date: d,
        weight: log.weight ?? null,
        movingAvg,
        calories: log.calories || 0,
        carbs: log.totalCarbs || 0,
        protein: log.totalProtein || 0,
        fat: log.totalFat || 0,
        targetCalories: targets.calories,
        targetCarbs: targets.carbs,
        targetProtein: targets.protein,
        targetFat: targets.fat,
      });
    }

    // Last 7 days macros
    const recentLogs = dates.slice(-7).map(d => state.dailyLogs[d]);
    const macroTotal = recentLogs.reduce(
      (acc, log) => ({
        carbs: acc.carbs + (log.totalCarbs || 0),
        protein: acc.protein + (log.totalProtein || 0),
        fat: acc.fat + (log.totalFat || 0),
        calories: acc.calories + (log.calories || 0),
      }),
      { carbs: 0, protein: 0, fat: 0, calories: 0 }
    );

    const carbCals = macroTotal.carbs * 4;
    const proteinCals = macroTotal.protein * 4;
    const fatCals = macroTotal.fat * 9;
    const totalCals = carbCals + proteinCals + fatCals || 1;

    // Goal adherence: % of days where calories ≤ 110% of target (with some logged food)
    let daysOnTarget = 0;
    let daysWithData = 0;
    for (const d of dates.slice(-14)) {
      const log = state.dailyLogs[d];
      if ((log.calories || 0) > 0 && targets.calories > 0) {
        daysWithData++;
        if (log.calories <= targets.calories * 1.1) daysOnTarget++;
      }
    }
    const goalRate = daysWithData > 0 ? Math.round((daysOnTarget / daysWithData) * 100) : null;

    return NextResponse.json({
      weightData,
      dailySeries,
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
      goalRate,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
