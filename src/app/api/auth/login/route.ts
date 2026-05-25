import { NextRequest, NextResponse } from 'next/server';
import { kvGetAccountByUsername } from '@/lib/accounts';
import { verifyPassword, makeToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const trimmed = (username || '').trim();
    if (!trimmed || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    const account = await kvGetAccountByUsername(trimmed);
    if (!account) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const valid = verifyPassword(password, account.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const token = makeToken(account.userId);
    const response = NextResponse.json({ success: true, token, userId: account.userId });
    response.cookies.set('fl_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return response;
  } catch (e: any) {
    console.error('login error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
