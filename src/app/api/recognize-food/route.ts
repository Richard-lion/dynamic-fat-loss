import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.BIGMODEL_API_KEY;

// Use /chat/completions endpoint (not /images/understanding which is 404)
const BIGMODEL_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4v-flash';

export async function POST(req: NextRequest) {
  try {
    let imageUrl: string;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      // Accept JSON {image: "data:..."} or {image: "https://..."}
      const body = await req.json();
      imageUrl = body.image;
    } else {
      // multipart/formData — convert to base64 data URL
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
            { type: 'text', text: '你是一个专业的食物营养识别助手。请分析这张食物图片，返回JSON格式的营养信息。要求：1. 识别食物名称（中文）；2. 估算重量（克）；3. 估算每100克营养成分：碳水、蛋白质、脂肪、钠。格式：{"name":"食物名","weight":重量数字,"carbs":碳水,"protein":蛋白质,"fat":脂肪,"sodium":钠}。只返回可识别的食物，不要编造。如果无法识别，返回{"error":"无法识别，请上传清晰的单份食物照片"}。' }
          ]
        }],
        max_tokens: 512,
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

    const weight = analysis.weight || 100;
    const factor = weight / 100;

    return NextResponse.json({
      name: analysis.name,
      weight,
      carbs: Math.round((analysis.carbs || 0) * factor),
      protein: Math.round((analysis.protein || 0) * factor),
      fat: Math.round((analysis.fat || 0) * factor),
      sodium: Math.round((analysis.sodium || 0) * factor),
      calories: Math.round(((analysis.carbs || 0) * 4 + (analysis.protein || 0) * 4 + (analysis.fat || 0) * 9) * factor),
      raw: analysis,
    });

  } catch (e: any) {
    console.error('Recognize food error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}