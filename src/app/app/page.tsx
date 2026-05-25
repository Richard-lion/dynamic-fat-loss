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

function ProgressRing({ value, max, label, unit, color = 'var(--accent)', size = 82 }: any) {
  const pct = Math.min((value / max) * 100, 100);
  const r = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="ring-card" style={{ padding: 10 }}>
      <div className="ring-chart" style={{ width: size, height: size, margin: '0 auto 6px' }}>
        <svg width={size} height={size}>
          <circle className="bg" cx={size / 2} cy={size / 2} r={r} />
          <circle className="fg" cx={size / 2} cy={size / 2} r={r} stroke={color} strokeDasharray={circ} strokeDashoffset={offset} style={{ stroke: color }} />
        </svg>
        <div className="center-text">
          <span className="num" style={{ fontSize: 13 }}>{value}</span>
          <span className="unit" style={{ fontSize: 9 }}>{unit}</span>
        </div>
      </div>
      <div className="ring-label" style={{ fontSize: 11 }}>{label}</div>
      <div className="ring-values" style={{ fontSize: 10 }}>{value}/{max}</div>
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
  const [customFood, setCustomFood] = useState({ name: '', weight: '', carbs: '', protein: '', fat: '', sodium: '' });
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
    } catch {
      setToast('载入失败');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    if (data.daysLeftInCycle === 0 && data.cycleState && !data.cycleState.settled) {
      setShowSettlement(true);
    }
  }, [data]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const saveWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) { showToast('请输入有效体重'); return; }
    try {
      const res = await apiFetch('/api/weight', {
        method: 'POST',
        body: JSON.stringify({ weight: w }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast('体重已记录 ✓');
      load();
    } catch (e: any) { showToast(e.message); }
  };

  const addFood = async (food: any, weight: number) => {
    const carbs = Math.round((food.carbs / food.per) * weight);
    const protein = Math.round((food.protein / food.per) * weight);
    const fat = Math.round((food.fat / food.per) * weight);
    const sodium = Math.round((food.sodium / food.per) * weight);
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
      setCustomFood({ name: '', weight: '', carbs: '', protein: '', fat: '', sodium: '' });
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

  const meals = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const mealLabels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '点心' };
  const mealIcons: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text2)', fontSize: 14 }}>
      载入中...
    </div>
  );

  if (!data) return (
    <div className="container">
      <p style={{ color: 'var(--text2)', textAlign: 'center', marginTop: 40, fontSize: 13 }}>载入失败</p>
    </div>
  );

  const { todayLog, targets, todayWeight, dayIndex, dayOfCycle, daysLeftInCycle, cycleNumber, totalDays, sodiumMg, sodiumPercent, sodiumColor } = data;

  const kcalPct = Math.round((todayLog.calories / (targets.calories || 1)) * 100);
  const carbsPct = Math.round((todayLog.totalCarbs / (targets.carbs || 1)) * 100);
  const proteinPct = Math.round((todayLog.totalProtein / (targets.protein || 1)) * 100);
  const fatPct = Math.round((todayLog.totalFat / (targets.fat || 1)) * 100);

  return (
    <>
      <div className="container" style={{ padding: '12px 14px 90px', maxWidth: '100%' }}>
        <div className="header" style={{ padding: '12px 0 14px' }}>
          <div>
            <h1 style={{ fontSize: 18 }}>⚖️ 动态减脂</h1>
            <div className="subtitle" style={{ fontSize: 11 }}>第 {cycleNumber} 个 10 天周期</div>
          </div>
        </div>

        <div className="cycle-banner" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 26 }}>🎯</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>第 {dayOfCycle} 天 / 共 10 天</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>距离下次动态调整还有 {daysLeftInCycle} 天</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{daysLeftInCycle}</div>
        </div>

        <div style={{ background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--accent2)', lineHeight: 1.5, marginBottom: 12 }}>
          💡 体重短期波动多为水分或盐分滞留，请专注 7 天移动平均线的下滑趋势！
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 10px', fontSize: 11, color: 'var(--text2)' }}>
            📅 第 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{dayIndex + 1}</span> 天
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 10px', fontSize: 11, color: 'var(--text2)' }}>
            ⏱️ 剩余 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{totalDays - dayIndex - 1}</span> 天
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 10px', fontSize: 11, color: 'var(--text2)' }}>
            ⚙️ 碳水 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{targets.carbs}g</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
          <ProgressRing value={todayLog.calories} max={targets.calories || 2000} label="热量" unit="kcal" color={kcalPct > 100 ? 'var(--danger)' : 'var(--accent)'} size={80} />
          <ProgressRing value={todayLog.totalCarbs} max={targets.carbs || 150} label="碳水" unit="g" color={carbsPct > 100 ? 'var(--warn)' : 'var(--accent2)'} size={80} />
          <ProgressRing value={todayLog.totalProtein} max={targets.protein || 100} label="蛋白" unit="g" color="var(--accent2)" size={80} />
          <ProgressRing value={todayLog.totalFat} max={targets.fat || 60} label="脂肪" unit="g" color={fatPct > 100 ? 'var(--warn)' : '#f0a030'} size={80} />
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
            <span>🧂 钠摄入</span>
            <span style={{ color: sodiumColor === 'green' ? 'var(--accent2)' : sodiumColor === 'yellow' ? 'var(--warn)' : 'var(--danger)' }}>
              {sodiumMg}mg / 2300mg
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${sodiumPercent}%`, height: '100%', borderRadius: 4, background: sodiumColor === 'green' ? 'var(--accent2)' : sodiumColor === 'yellow' ? 'var(--warn)' : 'var(--danger)', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)' }}>
            <span>健康区间: &lt;1800mg</span>
            <span style={{ color: sodiumColor === 'green' ? 'var(--accent2)' : 'var(--text2)' }}>{sodiumPercent}%</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📝 今日体重</div>
          {todayWeight && (
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>已记录：{todayWeight} kg</div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="number"
              step="0.1"
              placeholder="68.5"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              style={{ flex: 1, fontSize: 22, fontWeight: 700, textAlign: 'center', padding: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', outline: 'none', minWidth: 0 }}
            />
            <button onClick={saveWeight} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>记录</button>
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          {meals.map(meal => {
            const foods = todayLog.foods.filter((f: FoodEntry) => f.meal === meal);
            const mealCarbs = foods.reduce((s: number, f: FoodEntry) => s + f.carbs, 0);
            const mealCal = foods.reduce((s: number, f: FoodEntry) => s + f.calories, 0);

            return (
              <div key={meal} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => { setSelectedMeal(meal); setShowAddFood(true); }}>
                  <div>
                    <span style={{ marginRight: 6 }}>{mealIcons[meal]}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{mealLabels[meal]}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    {foods.length > 0 ? `${mealCarbs}g碳水 · ${mealCal}kcal` : '点击添加'}
                  </div>
                </div>
                <div style={{ paddingBottom: 4 }}>
                  {foods.map((f: FoodEntry) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg2)', borderRadius: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', margin: '0 6px' }}>{f.weight}g · {f.calories}kcal</div>
                      <button onClick={() => deleteFood(f.id)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
        <a href="/app" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', color: 'var(--accent)', textDecoration: 'none', fontSize: 10 }}>
          <span style={{ fontSize: 20 }}>📊</span>
          追踪
        </a>
        <a href="/analytics" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', color: 'var(--text2)', textDecoration: 'none', fontSize: 10 }}>
          <span style={{ fontSize: 20 }}>📈</span>
          分析
        </a>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'none', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 20px', fontSize: 13, zIndex: 200, animation: 'fadeIn 0.3s ease', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }}>
          {toast}
        </div>
      )}

      {/* Add Food Modal */}
      {showAddFood && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowAddFood(false)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>🍽️ 添加食物 - {mealLabels[selectedMeal]}</h2>

            <div style={{ marginTop: 10 }}>
              <input
                type="text"
                placeholder="搜索食物资料库..."
                value={foodSearch}
                onChange={e => setFoodSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none', marginBottom: 8 }}
              />
              <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                {data.foodDatabase
                  .filter((f: any) => foodSearch === '' || f.name.includes(foodSearch))
                  .slice(0, 10)
                  .map((f: any) => (
                    <div key={f.id} onClick={() => addFood(f, f.per)} style={{ padding: '8px 10px', marginBottom: 4, background: 'var(--bg3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text2)' }}>碳水{f.carbs}g · 蛋白{f.protein}g · 脂肪{f.fat}g · {f.per}g/份</div>
                      </div>
                      <div style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 8 }}>选择</div>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}>
              <h3 style={{ fontSize: 13, marginBottom: 10, fontWeight: 600 }}>或自定义食物</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3, display: 'block' }}>食物名称</label>
                  <input value={customFood.name} onChange={e => setCustomFood({ ...customFood, name: e.target.value })} placeholder="例如：卤肉饭" style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3, display: 'block' }}>重量 (g)</label>
                  <input type="number" value={customFood.weight} onChange={e => setCustomFood({ ...customFood, weight: e.target.value })} placeholder="200" style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3, display: 'block' }}>碳水 (g)</label>
                  <input type="number" value={customFood.carbs} onChange={e => setCustomFood({ ...customFood, carbs: e.target.value })} placeholder="30" style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3, display: 'block' }}>蛋白 (g)</label>
                  <input type="number" value={customFood.protein} onChange={e => setCustomFood({ ...customFood, protein: e.target.value })} placeholder="10" style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3, display: 'block' }}>脂肪 (g)</label>
                  <input type="number" value={customFood.fat} onChange={e => setCustomFood({ ...customFood, fat: e.target.value })} placeholder="5" style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3, display: 'block' }}>钠 (mg)</label>
                  <input type="number" value={customFood.sodium} onChange={e => setCustomFood({ ...customFood, sodium: e.target.value })} placeholder="0" style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none' }} />
                </div>
              </div>
              <button
                style={{ width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
                onClick={() => {
                  if (!customFood.name || !customFood.weight) { showToast('请填写名称和重量'); return; }
                  addFood(
                    { name: customFood.name, carbs: parseFloat(customFood.carbs) || 0, protein: parseFloat(customFood.protein) || 0, fat: parseFloat(customFood.fat) || 0, sodium: parseFloat(customFood.sodium) || 0, per: parseFloat(customFood.weight) },
                    parseFloat(customFood.weight)
                  );
                }}
              >
                添加自定义食物
              </button>
            </div>

            <button onClick={() => setShowAddFood(false)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', marginTop: 8 }}>关闭</button>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {showSettlement && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 480, padding: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>🎯 第 {cycleNumber} 期 10 天结算</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>
              10 天周期已完成！请根据你的实际感受选择，系统将自动调整下一周期的营养目标。
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>这 10 天你的整体感觉是？</label>
              <select value={settlementFeel} onChange={e => setSettlementFeel(e.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none', appearance: 'none' }}>
                <option value="">请选择...</option>
                <option value="exhausted">极度饥饿、乏力、失眠（体重下降过快）</option>
                <option value="good">状态良好、有饱腹感（符合预期）</option>
                <option value="stuck">严格执行但体重没变 / 卡关</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowSettlement(false)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>稍后</button>
              <button onClick={handleSettlement} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>完成结算 →</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}