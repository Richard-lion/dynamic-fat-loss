import { NextResponse } from 'next/server';

export async function POST() {
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
    const allKeys: string[] = scanData.result?.[1] || [];

    // Delete all found keys + accounts
    const keysToDel = [...new Set([...allKeys, 'accounts'])];

    let deleted = 0;
    if (keysToDel.length > 0) {
      // Delete in batches of 50
      for (let i = 0; i < keysToDel.length; i += 50) {
        const batch = keysToDel.slice(i, i + 50);
        const delRes = await fetch(UPSTASH_URL, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(['DEL', ...batch]),
        });
        const delData = await delRes.json();
        deleted += delData.result;
      }
    }

    return NextResponse.json({ success: true, deleted, keysRemoved: keysToDel });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
