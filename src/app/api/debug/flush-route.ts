import { NextResponse } from 'next/server';
import { kvGetAccounts } from '@/lib/kv';

export async function GET() {
  try {
    const accounts = await kvGetAccounts();
    const usernames = Object.keys(accounts);
    return NextResponse.json({ count: usernames.length, usernames });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
