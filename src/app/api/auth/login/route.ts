import { NextRequest, NextResponse } from 'next/server';
import { getAccountByUsername } from '@/lib/accounts';
import { verifyPassword, makeToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    const account = getAccountByUsername(username);
    if (!account) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const valid = verifyPassword(password, account.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const token = makeToken(account.userId);
    return NextResponse.json({ success: true, token, userId: account.userId });
  } catch (e: any) {
    console.error('login error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}