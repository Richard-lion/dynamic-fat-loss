import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/store';
import { getUserStateAsync, setUserStateAsync } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const state = await getUserStateAsync(userId);
    return NextResponse.json({ favorites: state.favorites || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, weight, carbs, protein, fat, sodium, calories, unit, per } = await req.json();

    if (!name || !weight) {
      return NextResponse.json({ error: '名称和重量不能为空' }, { status: 400 });
    }

    const state = await getUserStateAsync(userId);
    if (!state.favorites) state.favorites = [];

    // Avoid duplicates by name
    if (state.favorites.some(f => f.name === name)) {
      return NextResponse.json({ error: '已收藏过该食物' }, { status: 409 });
    }

    const favorite = {
      id: crypto.randomUUID(),
      name,
      weight: Number(weight),
      carbs: Number(carbs) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      sodium: Number(sodium) || 0,
      calories: Number(calories) || 0,
      unit: unit || 'g',
      per: Number(per) || Number(weight),
      createdAt: new Date().toISOString(),
    };

    state.favorites.unshift(favorite); // newest first
    await setUserStateAsync(userId, state);

    return NextResponse.json({ success: true, favorite });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });

    const state = await getUserStateAsync(userId);
    if (!state.favorites) state.favorites = [];

    const idx = state.favorites.findIndex(f => f.id === id);
    if (idx === -1) return NextResponse.json({ error: '未找到该收藏' }, { status: 404 });

    state.favorites.splice(idx, 1);
    await setUserStateAsync(userId, state);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
