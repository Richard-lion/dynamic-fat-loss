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

**识别规则：**
1. 仔细找到营养成分表上的"每100g"数值。
2. 在JSON中返回精确的每100g数值，不要修改。
3. 然后估计这份食物的总重量（克），不要超过1000g。
4. 如果是单独包装的食物，看包装上写的净含量。

**返回格式（严格JSON，不要加任何说明文字）：**
{"name":"食物名称（中文）","weight":总重量（克，整数或一位小数）,"carbs_per100":每100g碳水（克，不四舍五入）,"protein_per100":每100g蛋白质（克，不四舍五入）,"fat_per100":每100g脂肪（克，不四舍五入）,"sodium_per100":每100g钠（毫克，整数，不四舍五入）,"confidence":"high/medium/low","note":"识别说明或注意事项"}

**重要：**
- carbs_per100/protein_per100/fat_per100/sodium_per100 必须严格等于营养成分表上"每100g"的数值。
- 绝对不要把"每份"当成"每100g"。
- 只返回一个食物。
- 如果图片模糊或没有营养成分表，返回 {"error":"图片不清晰或无营养成分表，无法准确识别"}。
- 如果完全无法识别，返回 {"error":"无法识别，请上传清晰的食物或营养成分表照片"}。` }
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