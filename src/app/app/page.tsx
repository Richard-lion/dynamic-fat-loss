'use client';

import { useEffect, useState, useCallback } from 'react';
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
  const [customFood, setCustomFood] = useState({ name:'', weight:'', carbs:'', protein:'', fat:'', sodium:'' });
  const [settlementFeel, setSettlementFeel] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/dashboard');
      if (res.status === 401) { router.push('/'); return; }
      const json = await res.json();
      if (json.error) { router.push('/'); return; }
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

  return (
    <>
      <div className="container">
        {/* Header */}
        <div className="header">
          <div>
            <h1>⚖️ 动态减脂</h1>
            <div className="subtitle">第 {cycleNumber} 个 10 天周期</div>
          </div>
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
          💡 体重短期波动多为水分或盐分滞留，请专注 7 天移动平均线的下滑趋势！
        </div>

        {/* Info Pills */}
        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
          <div className="pill">📅 第 <span className="val">{dayIndex+1}</span> 天</div>
          <div className="pill">⏱️ 剩余 <span className="val">{totalDays - dayIndex - 1}</span> 天</div>
          <div className="pill">⚙️ 碳水 <span className="val">{targets.carbs}g</span></div>
        </div>

        {/* Macro Rings */}
        <div className="ring-grid">
          <ProgressRing value={todayLog.calories}     max={targets.calories||2000} label="热量" unit="kcal" color={kcalPct>100 ? 'var(--danger)' : 'var(--accent)'} size={80} />
          <ProgressRing value={todayLog.totalCarbs}   max={targets.carbs||150}     label="碳水" unit="g"   color={carbsPct>100  ? 'var(--warn)' : '#3a9e6e'} size={80} />
          <ProgressRing value={todayLog.totalProtein}  max={targets.protein||100}   label="蛋白" unit="g"   color="var(--accent)" size={80} />
          <ProgressRing value={todayLog.totalFat}      max={targets.fat||60}         label="脂肪" unit="g"   color={fatPct>100 ? 'var(--warn)' : '#d4880a'} size={80} />
        </div>

        {/* Sodium */}
        <div className="sodium-section">
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
            <span>🧂 钠摄入</span>
            <span style={{ color: sodiumColor==='green'?'var(--success)':sodiumColor==='yellow'?'var(--warn)':'var(--danger)' }}>
              {sodiumMg}mg / 2300mg
            </span>
          </div>
          <div className="sodium-bar">
            <div className={`sodium-fill ${sodiumColor}`} style={{ width:`${sodiumPercent}%` }} />
          </div>
          <div className="sodium-label">
            <span>健康区间: &lt;1800mg</span>
            <span style={{ color: sodiumColor==='green'?'var(--success)':'var(--text2)' }}>{sodiumPercent}%</span>
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
                    {foods.length > 0 ? `${mealCarbs}g碳水 · ${mealCal}kcal` : '点击添加'}
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🍽️ 添加食物 — {mealLabels[selectedMeal]}</h2>

            <div style={{ marginTop:10 }}>
              <input
                type="text" placeholder="搜索食物资料库..."
                value={foodSearch}
                onChange={e => setFoodSearch(e.target.value)}
                style={{ width:'100%', padding:'10px 14px', fontSize:13, background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)', outline:'none', marginBottom:8 }}
              />
              <div style={{ maxHeight:160, overflowY:'auto' }}>
                {data.foodDatabase
                  .filter((f:any) => foodSearch === '' || f.name.includes(foodSearch))
                  .slice(0,10)
                  .map((f:any) => (
                    <div key={f.id} className="food-search-item" onClick={() => addFood(f, f.per)}>
                      <div>
                        <div className="f-name">{f.name}</div>
                        <div className="f-macros">碳水{f.carbs}g · 蛋白{f.protein}g · 脂肪{f.fat}g · {f.per}g/份</div>
                      </div>
                      <div className="f-action">选择</div>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border)', marginTop:16, paddingTop:16 }}>
              <h3 style={{ fontSize:14, marginBottom:10, fontWeight:600 }}>或自定义食物</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { key:'name',    label:'食物名称', placeholder:'例如：卤肉饭', type:'text' },
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
                  addFood(
                    { name:customFood.name, carbs:parseFloat(customFood.carbs)||0, protein:parseFloat(customFood.protein)||0, fat:parseFloat(customFood.fat)||0, sodium:parseFloat(customFood.sodium)||0, per:parseFloat(customFood.weight) },
                    parseFloat(customFood.weight)
                  );
                }}
              >
                添加自定义食物
              </button>
            </div>

            <button className="btn-secondary" style={{ marginTop:8, width:'100%' }} onClick={() => setShowAddFood(false)}>关闭</button>
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
