import { NextRequest, NextResponse } from 'next/server';
import { parseToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('fl_token');
  if (!token) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const parsed = parseToken(token.value);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  return NextResponse.json({ userId: parsed.userId, exp: parsed.exp, token: token.value });
}
