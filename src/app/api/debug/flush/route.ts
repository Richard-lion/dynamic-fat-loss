import { NextResponse } from 'next/server';

// Debug: flush all user data — only call this manually
export async function POST() {
  try {
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return NextResponse.json({ error: 'No credentials' }, { status: 500 });
    }

    // Delete all user keys (accounts + all user:* keys)
    // Use SCAN to find keys first, then DEL
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
    const accountExists = accountRes.ok;

    const keysToDel = [...userKeys];
    if (accountExists) keysToDel.push('accounts');

    if (keysToDel.length > 0) {
      const delRes = await fetch(UPSTASH_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['DEL', ...keysToDel]),
      });
      const delData = await delRes.json();
      return NextResponse.json({ success: true, deleted: keysToDel.length, keys: keysToDel, result: delData.result });
    }

    return NextResponse.json({ success: true, deleted: 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
