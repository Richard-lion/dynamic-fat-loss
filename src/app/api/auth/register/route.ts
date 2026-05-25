import { NextRequest, NextResponse } from 'next/server';
import { getAccountByUsername, createAccount, usernameExists } from '@/lib/accounts';
import { hashPassword, makeToken } from '@/lib/auth';
import { getUserState } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json({ error: '用户名需要 3-30 个字符' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少 6 个字符' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
      return NextResponse.json({ error: '用户名只能包含字母、数字、下划线和中文' }, { status: 400 });
    }

    if (usernameExists(username)) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const userId = crypto.randomUUID();

    // Create account
    createAccount(username, passwordHash, userId);

    // Initialize user state (empty - onboarding will fill it)
    const state = getUserState(userId);
    state.user = {
      id: userId,
      gender: 'male',
      workoutLevel: '4-5',
      totalDurationDays: 60,
      startDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    state.currentWeight = 0;
    state.dailyLogs = {};
    state.cycleState = null;
    state.targets = null;
    // Note: we deliberately don't save state here — onboarding will do it

    const token = makeToken(userId);
    return NextResponse.json({ success: true, token, userId });
  } catch (e: any) {
    console.error('register error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}