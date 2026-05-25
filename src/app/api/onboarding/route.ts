import { NextRequest, NextResponse } from 'next/server';
import { getUserState, setUserState, getUserIdFromRequest } from '@/lib/store';
import { calcDailyTargets } from '@/lib/algorithm';

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const { gender, weight, workoutLevel, totalDurationDays } = await req.json();

    if (!gender || !weight || !workoutLevel || !totalDurationDays) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }

    if (!['male', 'female'].includes(gender)) {
      return NextResponse.json({ error: '性别必须为 male 或 female' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const state = getUserState(userId);

    state.user = {
      id: userId,
      gender,
      workoutLevel,
      totalDurationDays,
      startDate: today,
      createdAt: new Date().toISOString(),
    };

    state.currentWeight = weight;

    const targets = calcDailyTargets(gender, workoutLevel, weight, 1.0);
    state.targets = targets;

    state.cycleState = {
      cycleNumber: 1,
      startDayIndex: 0,
      startWeight: weight,
      baseWeight: weight,
      carbModifier: 1.0,
      targetCarbs: targets.carbs,
      targetProtein: targets.protein,
      targetFat: targets.fat,
      targetCalories: targets.calories,
      settled: false,
    };

    const todayLog = {
      date: today,
      weight: null as number | null,
      foods: [],
      totalCarbs: 0,
      totalProtein: 0,
      totalFat: 0,
      totalSodium: 0,
      calories: 0,
    };
    state.dailyLogs[today] = todayLog;

    setUserState(userId, state);

    return NextResponse.json({
      success: true,
      userId,
      token: userId,
      targets,
      cycleState: state.cycleState,
    });
  } catch (e: any) {
    console.error('onboarding error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}