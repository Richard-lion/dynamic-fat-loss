import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return NextResponse.json({ error: 'No credentials' }, { status: 500 });

    // Get all keys
    const scanRes = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SCAN', '0', 'COUNT', '100']),
    });
    const scanData = await scanRes.json();

    // Get accounts
    const accRes = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', 'accounts']),
    });
    const accData = await accRes.json();

    return NextResponse.json({
      allKeys: scanData.result,
      accounts: accData.result,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
