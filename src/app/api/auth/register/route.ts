import { NextRequest, NextResponse } from 'next/server';
import { kvUsernameExists, kvCreateAccount } from '@/lib/accounts';
import { hashPassword, makeToken } from '@/lib/auth';
import { setUserStateAsync } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const trimmed = username.trim();

    if (trimmed.length < 3 || trimmed.length > 30) {
      return NextResponse.json({ error: '用户名需为 3-30 个字符' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmed)) {
      return NextResponse.json({ error: '用户名只能包含字母、数字、下划线或中文' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少 6 个字符' }, { status: 400 });
    }

    if (await kvUsernameExists(trimmed)) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const userId = crypto.randomUUID();

    // Create account in Redis
    await kvCreateAccount(trimmed, passwordHash, userId);

    // Initialize user state
    const state = {
      user: {
        id: userId,
        gender: 'male' as const,
        workoutLevel: '4-5',
        totalDurationDays: 60,
        startDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      },
      currentWeight: 0,
      dailyLogs: {},
      cycleState: null,
      targets: null,
    };

    // Persist user state to Redis
    await setUserStateAsync(userId, state);

    const token = makeToken(userId);
    const response = NextResponse.json({ success: true, token, userId });
    response.cookies.set('fl_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return response;
  } catch (e: any) {
    console.error('register error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
