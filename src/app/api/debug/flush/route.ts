import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return NextResponse.json({ error: 'No credentials' }, { status: 500 });

    const scanRes = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SCAN', '0', 'MATCH', 'user:*', 'COUNT', '1000']),
    });
    const scanData = await scanRes.json();
    const userKeys: string[] = scanData.result || [];

    const accountRes = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EXISTS', 'accounts']),
    });

    const keysToDel = [...userKeys];
    if (accountRes.ok) keysToDel.push('accounts');

    if (keysToDel.length > 0) {
      await fetch(UPSTASH_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['DEL', ...keysToDel]),
      });
    }

    return NextResponse.json({ success: true, deleted: keysToDel.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
