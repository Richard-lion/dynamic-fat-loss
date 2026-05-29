import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.BIGMODEL_API_KEY;
const BIGMODEL_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4v-flash';

export async function POST(req: NextRequest) {
  try {
    let imageUrl: string;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      const body = await req.json();
      imageUrl = body.image;
    } else {
      const formData = await req.formData();
      const imageFile = formData.get('image') as File | null;
      if (!imageFile) return NextResponse.json({ error: '缺少图片' }, { status: 400 });
      const buffer = await imageFile.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = imageFile.type || 'image/jpeg';
      imageUrl = `data:${mimeType};base64,${base64}`;
    }

    if (!imageUrl) return NextResponse.json({ error: '缺少图片' }, { status: 400 });

    const response = await fetch(BIGMODEL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: `你是一个专业的食物营养成分识别助手。请分析这张图片并返回JSON格式的营养数据。

**识别规则（严格按顺序优先级）：**
1. 如果图片是营养成分表/配料表/成分表 → 严格按照表上标注的【每100g】数值填写，不要估算，不要四舍五入，直接保留原始数字。
2. 如果图片是食物本身（没有成分表）→ 估算整份食物的重量（克）和对应的营养成分。
3. 如果图片同时包含成分表和实际食物 → 以成分表为准，并估算你看到的这份食物的总重量。

**返回格式（必须严格JSON）：**
{"name":"食物名称（中文）","weight":整份重量数字（克）,"carbs_per100":每100g碳水（克）,"protein_per100":每100g蛋白质（克）,"fat_per100":每100g脂肪（克）,"sodium_per100":每100g钠（毫克）,"confidence":"high/medium/low"}

**重要：**
- 如果看到营养成分表，carbs_per100/protein_per100/fat_per100/sodium_per100 必须等于成分表上每100g的数值。
- 不要估算，不要计算factor，全部返回每100g的原始值。
- weight 填你估算的这份食物的总重量（克）。
- 如果完全无法识别，返回 {"error":"无法识别，请上传清晰的食物或营养成分表照片"}。
- 只返回一个食物，不要返回多个。` }
          ]
        }],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BigModel API error:', response.status, errorText);
      return NextResponse.json({ error: `AI识别失败: ${response.status}` }, { status: 500 });
    }

    const result = await response.json();
    const content: string = result.choices?.[0]?.message?.content || '';

    let analysis: any = null;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { analysis = JSON.parse(jsonMatch[0]); } catch {}
    }

    if (!analysis || analysis.error) {
      return NextResponse.json({ error: analysis?.error || '识别失败，请重试' }, { status: 422 });
    }

    // Work in per-100g values then scale to total weight
    const weight = analysis.weight || 100;
    const factor = weight / 100;
    const carbs_per100 = analysis.carbs_per100 ?? analysis.carbs ?? 0;
    const protein_per100 = analysis.protein_per100 ?? analysis.protein ?? 0;
    const fat_per100 = analysis.fat_per100 ?? analysis.fat ?? 0;
    const sodium_per100 = analysis.sodium_per100 ?? analysis.sodium ?? 0;

    const carbs = Math.round(carbs_per100 * factor * 10) / 10;
    const protein = Math.round(protein_per100 * factor * 10) / 10;
    const fat = Math.round(fat_per100 * factor * 10) / 10;
    const sodium = Math.round(sodium_per100 * factor);

    return NextResponse.json({
      name: analysis.name,
      weight,
      carbs,
      protein,
      fat,
      sodium,
      carbs_per100,
      protein_per100,
      fat_per100,
      sodium_per100,
      calories: Math.round((carbs_per100 * 4 + protein_per100 * 4 + fat_per100 * 9) * factor),
      confidence: analysis.confidence || 'medium',
      raw: analysis,
    });

  } catch (e: any) {
    console.error('Recognize food error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}