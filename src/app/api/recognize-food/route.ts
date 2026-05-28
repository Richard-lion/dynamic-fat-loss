import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.BIGMODEL_API_KEY;
const MODEL = 'glm-4v-flashx';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ error: '缺少图片' }, { status: 400 });
    }

    // Convert file to base64
    const buffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Call BigModel GLM-4V-FlashX API
    const response = await fetch(`https://open.bigmodel.cn/api/paas/v4/images/understanding`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        image: dataUrl,
        prompt: `你是一个专业的食物营养识别助手。请分析这张食物图片，返回JSON格式的营养信息。

要求：
1. 识别图片中的食物种类（中文名称）
2. 估算食物重量（单位：克）
3. 估算营养成分（每100克的碳水、蛋白质、脂肪、钠，热量由系统计算）
4. 只返回你已经能够准确识别的食物，不要编造不确定的信息

请严格按以下JSON格式返回，不要返回任何其他内容：
{
  "name": "食物中文名称",
  "weight": 估算重量数字（单位：克）,
  "carbs": 每100克碳水（单位：克）,
  "protein": 每100克蛋白质（单位：克）,
  "fat": 每100克脂肪（单位：克）,
  "sodium": 每100克钠（单位：毫克）
}

如果无法识别或图片不清晰，请返回：
{
  "error": "无法识别，请上传清晰的单份食物照片"
}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BigModel API error:', response.status, errorText);
      return NextResponse.json({ error: `AI识别失败: ${response.status}` }, { status: 500 });
    }

    const result = await response.json();
    
    // Parse the AI response
    let analysis = null;
    const content = result.choices?.[0]?.message?.content || result.content || '';
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content);
    }

    if (!analysis || analysis.error) {
      return NextResponse.json({ 
        error: analysis?.error || '识别失败，请重试' 
      }, { status: 422 });
    }

    // Calculate totals based on weight
    const weight = analysis.weight || 100;
    const factor = weight / 100;

    return NextResponse.json({
      name: analysis.name,
      weight: weight,
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