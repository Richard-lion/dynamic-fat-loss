import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('fl_token')?.value;
  const authHeader = req.headers.get('Authorization') || '';
  
  let userId = null;
  let tokenParsed = false;
  
  if (authHeader.startsWith('Bearer ')) {
    const { parseToken } = await import('@/lib/auth');
    const parsed = parseToken(authHeader.slice(7).trim());
    if (parsed) { userId = parsed.userId; tokenParsed = true; }
  }
  
  if (!userId && token) {
    const { parseToken } = await import('@/lib/auth');
    const parsed = parseToken(token);
    if (parsed) { userId = parsed.userId; tokenParsed = true; }
  }
  
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  let redisUser = null;
  if (userId && redisUrl && redisToken) {
    try {
      const res = await fetch(redisUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['GET', `user:${userId}`]),
      });
      const data = await res.json();
      redisUser = data.result;
    } catch(e) { /* ignore */ }
  }
  
  return NextResponse.json({
    hasToken: !!token,
    tokenParsed,
    userId,
    redisConfigured: !!(redisUrl && redisToken),
    redisUser,
  });
}
