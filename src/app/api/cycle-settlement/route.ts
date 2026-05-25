import { NextRequest, NextResponse } from 'next/server';
import { getUserState, setUserState, getUserIdFromRequest } from '@/lib/store';
import { calcDailyTargets } from '@/lib/algorithm';

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const state = getUserState(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    return NextResponse.json({ cycleState: state.cycleState, canSettle: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const { weightChange, userFeeling } = await req.json();
    const state = getUserState(userId);
    if (!state.user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    if (!state.cycleState) return NextResponse.json({ error: '无活跃周期' }, { status: 400 });

    let carbMod = 1.0;
    let adjustment = '维持';

    if (weightChange > 2 && userFeeling === 'exhausted') {
      carbMod = 1.1;
      adjustment = '调高碳水 +10%';
    } else if (weightChange < -0.5) {
      carbMod = 0.9;
      adjustment = '调低碳水 -10%';
    }

    const newTargets = calcDailyTargets(
      state.user.gender,
      state.user.workoutLevel,
      state.currentWeight,
      carbMod
    );

    state.cycleState.settled = true;
    const nextCycleNumber = state.cycleState.cycleNumber + 1;

    state.cycleState = {
      cycleNumber: nextCycleNumber,
      startDayIndex: state.cycleState.startDayIndex + 10,
      startWeight: state.currentWeight,
      baseWeight: state.currentWeight,
      carbModifier: carbMod,
      targetCarbs: newTargets.carbs,
      targetProtein: newTargets.protein,
      targetFat: newTargets.fat,
      targetCalories: newTargets.calories,
      settled: false,
    };

    state.targets = newTargets;
    setUserState(userId, state);

    return NextResponse.json({
      success: true,
      adjustment,
      previousCarbs: state.cycleState.targetCarbs,
      newCarbs: newTargets.carbs,
      newTargets,
      nextCycleNumber,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}