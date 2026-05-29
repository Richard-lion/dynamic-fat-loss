'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('fl_token');
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ProgressRing({ value, max, label, unit, color, size = 80 }: any) {
  const pct = Math.min((value / max) * 100, 100);
  const strokeWidth = 7;
  const r = (size / 2) - strokeWidth;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="ring-card">
      {/* SVG is rotated -90deg so we draw from top (12 o'clock) */}
      <div style={{ width: size, height: size, position: 'relative', margin: '0 auto 8px' }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)', display: 'block' }}
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {/* Foreground ring (progress) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        {/* Text overlay — absolutely positioned over the SVG */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: 9, color: 'var(--text2)' }}>{unit}</span>
        </div>
      </div>
      <div className="ring-label">{label}</div>
      <div className="ring-values">{value}/{max}</div>
    </div>
  );
}

interface FoodEntry {
  id: string; name: string; weight: number; carbs: number; protein: number;
  fat: number; sodium: number; calories: number; meal: string;
}

export default function AppPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [showAddFood, setShowAddFood] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [foodSearch, setFoodSearch] = useState('');
  const [showCameraMode, setShowCameraMode] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [customFood, setCustomFood] = useState({ name:'', weight:'', carbs:'', protein:'', fat:'', sodium:'' });
  const [settlementFeel, setSettlementFeel] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/dashboard');
      if (res.status === 401) { router.push('/login'); return; }
      const json = await res.json();
      if (json.error === '用户不存在') { router.push('/'); return; }
      setData(json);
      const w = json.todayWeight ?? json.weight ?? '';
      setWeightInput(w ? String(w) : '');
    } catch { setToast('载入失败'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    if (data.daysLeftInCycle === 0 && data.cycleState && !data.cycleState.settled) {
      setShowSettlement(true);
    }
  }, [data]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const saveWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) { showToast('请输入有效体重'); return; }
    try {
      const res = await apiFetch('/api/weight', { method: 'POST', body: JSON.stringify({ weight: w }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast('体重已记录 ✓');
      load();
    } catch (e: any) { showToast(e.message); }
  };

  const addFood = async (food: any, weight: number) => {
    const carbs   = Math.round((food.carbs   / food.per) * weight);
    const protein = Math.round((food.protein / food.per) * weight);
    const fat     = Math.round((food.fat     / food.per) * weight);
    const sodium  = Math.round((food.sodium  / food.per) * weight);
    const calories = Math.round(carbs * 4 + protein * 4 + fat * 9);
    try {
      const res = await apiFetch('/api/food-log', {
        method: 'POST',
        body: JSON.stringify({ name: food.name, weight, carbs, protein, fat, sodium, calories, meal: selectedMeal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(`已添加 ${food.name}`);
      setShowAddFood(false);
      setFoodSearch('');
      setCustomFood({ name:'', weight:'', carbs:'', protein:'', fat:'', sodium:'' });
      load();
    } catch (e: any) { showToast(e.message); }
  };

  const deleteFood = async (id: string) => {
    try {
      const res = await apiFetch(`/api/food-log?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      load();
    } catch (e: any) { showToast(e.message); }
  };

  const toggleFavorite = async (food: any) => {
    const isFav = data.favorites.some((f: any) => f.name === food.name);
    try {
      if (isFav) {
        const fav = data.favorites.find((f: any) => f.name === food.name);
        await apiFetch(`/api/favorites?id=${fav.id}`, { method: 'DELETE' });
        showToast(`已取消收藏`);
      } else {
        await apiFetch('/api/favorites', {
          method: 'POST',
          body: JSON.stringify({
            name: food.name, weight: food.per || food.weight, carbs: food.carbs,
            protein: food.protein, fat: food.fat, sodium: food.sodium,
            calories: food.calories || Math.round(food.carbs * 4 + food.protein * 4 + food.fat * 9),
            unit: food.unit || 'g', per: food.per || food.weight,
          }),
        });
        showToast(`已收藏 ⭐`);
      }
      load();
    } catch (e: any) { showToast(e.message); }
  };

  const handleSettlement = async () => {
    if (!data || !data.todayWeight) { showToast('请先记录今天体重再进行结算'); return; }
    const startWeight = data.cycleState?.startWeight || data.weight;
    const weightChange = parseFloat((startWeight - data.todayWeight).toFixed(1));
    try {
      const res = await apiFetch('/api/cycle-settlement', {
        method: 'POST',
        body: JSON.stringify({ weightChange, userFeeling: settlementFeel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(`第 ${data.cycleNumber} 周期结算完成！${json.adjustment}`);
      setShowSettlement(false);
      load();
    } catch (e: any) { showToast(e.message); }
  };

  const meals = ['breakfast','lunch','dinner','snack'] as const;
  const mealLabels: Record<string,string> = { breakfast:'早餐', lunch:'午餐', dinner:'晚餐', snack:'点心' };
  const mealIcons: Record<string,string>  = { breakfast:'🌅', lunch:'☀️', dinner:'🌙', snack:'🍎' };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <div style={{ fontSize:13, color:'var(--text2)' }}>载入中...</div>
    </div>
  );

  if (!data) return (
    <div className="container">
      <p style={{ color:'var(--text2)', textAlign:'center', marginTop:40, fontSize:13 }}>载入失败</p>
    </div>
  );

  const { todayLog, targets, todayWeight, dayIndex, dayOfCycle, daysLeftInCycle, cycleNumber, totalDays, sodiumMg, sodiumPercent, sodiumColor } = data;

  const carbsPct    = Math.round((todayLog.totalCarbs   / (targets.carbs   || 1)) * 100);
  const proteinPct  = Math.round((todayLog.totalProtein / (targets.protein || 1)) * 100);
  const fatPct      = Math.round((todayLog.totalFat     / (targets.fat     || 1)) * 100);
  const kcalPct     = Math.round((todayLog.calories     / (targets.calories|| 1)) * 100);

  const logout = () => {
    localStorage.removeItem('fl_token');
    localStorage.removeItem('fl_userId');
    localStorage.removeItem('fl_username');
    document.cookie = 'fl_token=; Max-Age=0; path=/';
    router.push('/login');
  };

  return (
    <>
      <div className="container">
        {/* Header */}
        <div className="header">
          <div>
            <h1>⚖️ 动态减脂</h1>
            <div className="subtitle">第 {cycleNumber} 个 10 天周期</div>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text2)',
              fontSize: 12,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            登出
          </button>
        </div>

        {/* Cycle Banner */}
        <div className="cycle-banner">
          <div style={{ fontSize:26 }}>🎯</div>
          <div className="cb-text">
            <div className="cb-title">第 {dayOfCycle} 天 / 共 10 天</div>
            <div className="cb-sub">距离下次动态调整还有 {daysLeftInCycle} 天</div>
          </div>
          <div className="cb-days">{daysLeftInCycle}</div>
        </div>

        {/* Tip */}
        <div className="tip-box">
          💡 体重波动多为水分滞留，请专注 7 天移动均线的下滑趋势！
        </div>

        {/* Macro Rings */}
        <div className="ring-grid">
          <ProgressRing value={todayLog.calories}     max={targets.calories||2000} label="热量" unit="kcal" color={kcalPct>100 ? 'var(--danger)' : 'var(--accent)'} size={110} />
          <ProgressRing value={todayLog.totalCarbs}   max={targets.carbs||150}     label="碳水" unit="g"   color={carbsPct>100  ? 'var(--warn)' : '#3a9e6e'} size={72} />
          <ProgressRing value={todayLog.totalProtein}  max={targets.protein||100}   label="蛋白" unit="g"   color="var(--accent)" size={72} />
          <ProgressRing value={todayLog.totalFat}      max={targets.fat||60}         label="脂肪" unit="g"   color={fatPct>100 ? 'var(--warn)' : '#d4880a'} size={72} />
        </div>

        {/* Sodium */}
        <div className="sodium-section">
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
            <span>🧂 钠摄入</span>
            <span style={{ color: sodiumColor==='orange'?'var(--warn)':sodiumColor==='yellow'?'var(--warn)':'var(--danger)' }}>
              {sodiumMg}mg / 2300mg
            </span>
          </div>
          <div className="sodium-bar">
            <div className={`sodium-fill ${sodiumColor}`} style={{ width:`${sodiumPercent}%` }} />
          </div>
          <div className="sodium-label">
            <span>健康区间: &lt;1800mg</span>
            <span style={{ color: sodiumColor==='orange'?'var(--warn)':'var(--text2)' }}>{sodiumPercent}%</span>
          </div>
        </div>

        {/* Weight */}
        <div className="card">
          <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>📝 今日体重</div>
          {todayWeight && (
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8 }}>已记录：{todayWeight} kg</div>
          )}
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <input
              type="number" step="0.1" placeholder="68.5"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              style={{ flex:1, fontSize:24, fontWeight:700, textAlign:'center', padding:'12px', background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)', outline:'none', minWidth:0 }}
            />
            <button onClick={saveWeight} style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius)', padding:'12px 18px', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 2px 8px rgba(232,98,58,0.25)' }}>
              记录
            </button>
          </div>
        </div>

        {/* Meals */}
        <div style={{ marginTop:4 }}>
          {meals.map(meal => {
            const foods = todayLog.foods.filter((f:FoodEntry) => f.meal === meal);
            const mealCarbs = foods.reduce((s:number,f:FoodEntry) => s+f.carbs, 0);
            const mealCal   = foods.reduce((s:number,f:FoodEntry) => s+f.calories, 0);
            return (
              <div key={meal} style={{ marginBottom:12 }}>
                <div
                  style={{ display:'flex', justifyContent:'space-between', padding:'11px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                  onClick={() => { setSelectedMeal(meal); setShowAddFood(true); }}
                >
                  <div>
                    <span style={{ marginRight:6 }}>{mealIcons[meal]}</span>
                    <span style={{ fontSize:14, fontWeight:600 }}>{mealLabels[meal]}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text2)' }}>
                    {foods.length > 0 ? `${mealCarbs}g碳水 · ${mealCal}kcal` : <button style={{fontSize:16,color:'var(--coral)',background:'none',border:'none',cursor:'pointer',padding:'0 4px',fontWeight:300}}>+</button>}
                  </div>
                </div>
                <div style={{ paddingBottom:4 }}>
                  {foods.map((f:FoodEntry) => (
                    <div key={f.id} className="food-item">
                      <span className="name">{f.name}</span>
                      <span className="macros">{f.weight}g · {f.calories}kcal</span>
                      <button className="del" onClick={() => deleteFood(f.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="nav-bar">
        <a href="/app" className="nav-item active">
          <span className="nav-icon">📊</span>追踪
        </a>
        <a href="/analytics" className="nav-item">
          <span className="nav-icon">📈</span>分析
        </a>
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Add Food Modal */}
      {showAddFood && (
        <div className="modal-overlay" onClick={() => setShowAddFood(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h2>🍽️ 添加食物 — {mealLabels[selectedMeal]}</h2>
              <button
                onClick={() => {
                  setCustomFood({ name:'', weight:'', carbs:'', protein:'', fat:'', sodium:'' });
                  setFoodSearch('');
                  setShowCameraMode(false);
                  setRecognitionResult(null);
                  setRecognizing(false);
                }}
                style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer', color:'var(--text)' }}
              >
                重置
              </button>
            </div>

            {/* Camera button + search */}
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <button
                onClick={() => setShowCameraMode(true)}
                style={{ background: showCameraMode ? 'var(--accent)' : 'var(--bg3)', color: showCameraMode ? '#fff' : 'var(--text)', border:'1.5px solid var(--border)', borderRadius:9, padding:'9px 14px', fontSize:13, cursor:'pointer', flexShrink:0 }}
              >
                📷 AI识别
              </button>
              <input
                type="text" placeholder="搜索食物..."
                value={foodSearch}
                onChange={e => { setFoodSearch(e.target.value); setShowCameraMode(false); }}
                style={{ flex:1, padding:'9px 12px', fontSize:13, background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:9, color:'var(--text)', outline:'none' }}
              />
            </div>

            {/* Camera mode */}
            {showCameraMode && (
              <div style={{ marginBottom:12 }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={cameraInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setRecognizing(true);
                    try {
                      const formData = new FormData();
                      formData.append('image', file);
                      const res = await fetch('/api/recognize-food', {
                        method: 'POST',
                        body: formData,
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || '识别失败');
                      setRecognitionResult(json);
                      setRecognizing(false);
                    } catch (err: any) {
                      setRecognizing(false);
                      showToast(err.message || '识别失败，请重试');
                    }
                  }}
                  style={{ display:'none' }}
                />
                <div
                  onClick={() => cameraInputRef.current?.click()}
                  style={{ background:'var(--bg3)', border:'2px dashed var(--border)', borderRadius:12, padding:'28px', textAlign:'center', cursor:'pointer', color:'var(--text2)', fontSize:13 }}
                >
                  <div style={{ fontSize:28, marginBottom:6 }}>📷</div>
                  点击拍照或从相册选择
                </div>
              </div>
            )}

            {/* Recogniton loading */}
            {recognizing && (
              <div style={{ textAlign:'center', padding:'32px 0' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:6 }}>AI 正在识别中...</div>
                <div style={{ fontSize:12, color:'var(--text2)' }}>请稍等，结果会显示在下方</div>
              </div>
            )}

            {/* Recognition confirm page */}
            {!recognizing && recognitionResult && (
              <div style={{ background:'var(--bg2)', border:'1.5px solid var(--coral)', borderRadius:12, padding:'16px', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--coral)', marginBottom:10 }}>✓ AI 识别结果 v2 — 请确认以下信息</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { key:'name',   label:'食物名称', type:'text', value: recognitionResult.name },
                    { key:'weight', label:'重量 (g)', type:'number', value: String(recognitionResult.weight) },
                    { key:'carbs',  label:'碳水 (g)', type:'number', value: String(recognitionResult.carbs) },
                    { key:'protein',label:'蛋白 (g)', type:'number', value: String(recognitionResult.protein) },
                    { key:'fat',    label:'脂肪 (g)', type:'number', value: String(recognitionResult.fat) },
                    { key:'sodium', label:'钠 (mg)',  type:'number', value: String(recognitionResult.sodium) },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize:11, color:'var(--text2)', marginBottom:3, display:'block' }}>{f.label}</label>
                      <input
                        type={f.type}
                        value={f.value}
                        onChange={e => setRecognitionResult({ ...recognitionResult, [f.key]: f.type === 'number' ? parseFloat(e.target.value)||0 : e.target.value })}
                        style={{ width:'100%', padding:'8px 10px', fontSize:13, background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)', outline:'none' }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:6, marginBottom:12 }}>
                  热量估算：{(recognitionResult.carbs||0)*4 + (recognitionResult.protein||0)*4 + (recognitionResult.fat||0)*9} kcal
                  {recognitionResult.confidence && <span style={{ marginLeft:8, color:recognitionResult.confidence==='high'?'var(--success)':recognitionResult.confidence==='medium'?'var(--warn)':'var(--error)' }}>· 置信度：{recognitionResult.confidence}</span>}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button
                    className="btn-primary"
                    style={{ flex:1, fontSize:13 }}
                    onClick={() => {
                      setCustomFood({
                        name: String(recognitionResult.name),
                        weight: String(recognitionResult.weight),
                        carbs: String(recognitionResult.carbs),
                        protein: String(recognitionResult.protein),
                        fat: String(recognitionResult.fat),
                        sodium: String(recognitionResult.sodium),
                      });
                      setRecognitionResult(null);
                      setShowCameraMode(false);
                    }}
                  >
                    确认 — 填入表单
                  </button>
                  <button
                    style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:9, padding:'9px 12px', fontSize:13, cursor:'pointer', color:'var(--text2)' }}
                    onClick={() => setRecognitionResult(null)}
                  >
                    重拍
                  </button>
                </div>
              </div>
            )}

            {/* Favorites */}
            {data.favorites?.length > 0 && !showCameraMode && !recognitionResult && !recognizing && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:6, fontWeight:600 }}>⭐ 我的收藏</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:140, overflowY:'auto' }}>
                  {data.favorites.map((fav: any) => (
                    <div key={fav.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'var(--bg3)', borderRadius:9, border:'1px solid var(--border)' }}>
                      <div style={{ flex:1, cursor:'pointer' }} onClick={() => addFood(fav, fav.per || fav.weight)}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{fav.name}</div>
                        <div style={{ fontSize:10, color:'var(--text2)' }}>碳水{fav.carbs}g · 蛋白{fav.protein}g · 脂肪{fav.fat}g · {fav.per}{fav.unit}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(fav); }}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, padding:'2px 4px', color:'var(--accent)' }}
                      >
                        ⭐
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search results */}
            {!showCameraMode && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:6, fontWeight:600 }}>
                  📚 食物库 {foodSearch && `— 搜索"${foodSearch}"`}
                </div>
                <div style={{ maxHeight:160, overflowY:'auto' }}>
                  {data.foodDatabase
                    .filter((f:any) => foodSearch === '' || f.name.includes(foodSearch))
                    .slice(0,12)
                    .map((f:any) => {
                      const isFav = data.favorites?.some((fv: any) => fv.name === f.name);
                      return (
                        <div key={f.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 4px', borderBottom:'1px solid var(--border)' }}>
                          <div style={{ flex:1, cursor:'pointer' }} onClick={() => addFood(f, f.per)}>
                            <div style={{ fontSize:13, fontWeight:500 }}>{f.name}</div>
                            <div style={{ fontSize:10, color:'var(--text2)' }}>碳水{f.carbs}g · 蛋白{f.protein}g · 脂肪{f.fat}g · {f.per}g/份</div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(f); }}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, padding:'2px 6px', color: isFav ? 'var(--accent)' : 'var(--text3)' }}
                          >
                            {isFav ? '⭐' : '☆'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Custom food */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
              <h3 style={{ fontSize:14, marginBottom:10, fontWeight:600 }}>📝 自定义食物</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { key:'name',    label:'食物名称', placeholder:'例如：自制三明治', type:'text' },
                  { key:'weight',  label:'重量 (g)',  placeholder:'200',      type:'number' },
                  { key:'carbs',   label:'碳水 (g)',  placeholder:'30',       type:'number' },
                  { key:'protein', label:'蛋白 (g)',  placeholder:'10',       type:'number' },
                  { key:'fat',     label:'脂肪 (g)',  placeholder:'5',        type:'number' },
                  { key:'sodium',  label:'钠 (mg)',   placeholder:'0',        type:'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize:11, color:'var(--text2)', marginBottom:3, display:'block' }}>{f.label}</label>
                    <input
                      type={f.type} placeholder={f.placeholder}
                      value={(customFood as any)[f.key]}
                      onChange={e => setCustomFood({ ...customFood, [f.key]: e.target.value })}
                      style={{ width:'100%', padding:'8px 10px', fontSize:13, background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)', outline:'none' }}
                    />
                  </div>
                ))}
              </div>
              <button
                className="btn-primary"
                style={{ marginTop:12 }}
                onClick={() => {
                  if (!customFood.name || !customFood.weight) { showToast('请填写名称和重量'); return; }
                  const foodData = {
                    name: customFood.name,
                    carbs: parseFloat(customFood.carbs) || 0,
                    protein: parseFloat(customFood.protein) || 0,
                    fat: parseFloat(customFood.fat) || 0,
                    sodium: parseFloat(customFood.sodium) || 0,
                    per: parseFloat(customFood.weight),
                    weight: parseFloat(customFood.weight),
                    calories: Math.round((parseFloat(customFood.carbs) || 0) * 4 + (parseFloat(customFood.protein) || 0) * 4 + (parseFloat(customFood.fat) || 0) * 9),
                  };
                  addFood(foodData, foodData.weight);
                  // Also save to favorites
                  apiFetch('/api/favorites', {
                    method: 'POST',
                    body: JSON.stringify({
                      name: foodData.name,
                      weight: foodData.per,
                      carbs: foodData.carbs,
                      protein: foodData.protein,
                      fat: foodData.fat,
                      sodium: foodData.sodium,
                      calories: foodData.calories,
                      unit: 'g',
                      per: foodData.per,
                    }),
                  }).then(r => r.json()).then(j => {
                    if (j.success) { showToast(`已添加 ${foodData.name} 并收藏 ⭐`); load(); }
                    else showToast(`已添加 ${foodData.name}`);
                  }).catch(() => showToast(`已添加 ${foodData.name}`));
                }}
              >
                添加 + 保存到收藏
              </button>
            </div>

            <button className="btn-secondary" style={{ marginTop:8, width:'100%' }} onClick={() => { setShowAddFood(false); setShowCameraMode(false); }}>关闭</button>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {showSettlement && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>🎯 第 {cycleNumber} 期 10 天结算</h2>
            <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6, marginTop:4 }}>
              10 天周期已完成！请根据你的实际感受选择，系统将自动调整下一周期的营养目标。
            </p>

            <div className="settlement-feel">
              <div style={{ fontSize:12, color:'var(--text2)', marginBottom:4 }}>这 10 天你的整体感觉是？</div>
              {[
                { value:'exhausted', label:'极度饥饿、乏力、失眠（体重下降过快）' },
                { value:'good',      label:'状态良好、有饱腹感（符合预期）' },
                { value:'stuck',     label:'严格执行但体重没变 / 卡关' },
              ].map(opt => (
                <div
                  key={opt.value}
                  className={`settlement-option ${settlementFeel === opt.value ? 'active' : ''}`}
                  onClick={() => setSettlementFeel(opt.value)}
                >
                  {opt.label}
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowSettlement(false)}>稍后</button>
              <button className="btn-primary" style={{ flex:2 }} onClick={handleSettlement}>完成结算 →</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
