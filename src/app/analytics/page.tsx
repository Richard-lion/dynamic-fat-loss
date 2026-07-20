'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChartBar, ChartLineDown, TrendDown, TrendUp, Minus, Fire, DownloadSimple } from '@phosphor-icons/react';

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

interface DailyPoint {
  date: string;
  weight: number;
  movingAvg: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  targetCalories: number;
  targetCarbs: number;
  targetProtein: number;
  targetFat: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [chartMode, setChartMode] = useState<'weight' | 'calories' | 'macros'>('weight');

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/analytics');
      if (res.status === 401) { router.push('/'); return; }
      if (!res.ok) throw new Error('API error: ' + res.status);
      const json = await res.json();
      setData(json);
    } catch (e: any) { setToast('载入失败: ' + e.message); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    if (!data?.dailySeries) return;
    const rows = [
      ['日期','体重kg','7日均值','热量kcal','碳水g','蛋白g','脂肪g','目标热量','目标碳水','目标蛋白','目标脂肪'].join(','),
      ...data.dailySeries.map((d: DailyPoint) => [
        d.date, d.weight ?? '', d.movingAvg ?? '', d.calories, d.carbs, d.protein, d.fat,
        d.targetCalories, d.targetCarbs, d.targetProtein, d.targetFat,
      ].join(','))
    ];
    const csv = '\uFEFF' + rows.join('\n'); // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatloss-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <div style={{ fontSize:13, color:'var(--text2)' }}>载入中...</div>
    </div>
  );

  if (!data) return (
    <div className="container">
      <p style={{ color:'var(--text2)', textAlign:'center', marginTop:40, fontSize:13 }}>
        {toast || '载入失败，请返回重新尝试'}
      </p>
    </div>
  );

  const { weightData, dailySeries, macroTotal, macroPercentages, startWeight, currentWeight, daysLogged, goalRate } = data;
  const totalLossNum  = parseFloat((startWeight - currentWeight).toFixed(1));
  const lossClass     = totalLossNum > 0 ? 'down' : totalLossNum < 0 ? 'up' : '';
  const totalLossAbs  = Math.abs(totalLossNum);
  const weeklyRate    = daysLogged >= 7 ? parseFloat(((startWeight - currentWeight) / (daysLogged / 7)).toFixed(2)) : null;

  // ── Weight chart ────────────────────────────────────────────
  const renderWeightChart = () => {
    if (!weightData || weightData.length < 2) {
      return (
        <div style={{ height:150, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
          <div style={{ fontSize:40 }}><ChartBar size={40} /></div>
          <div style={{ fontSize:13, color:'var(--text2)' }}>至少需要 2 天体重数据</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>持续记录后就会显示趋势图</div>
        </div>
      );
    }
    const wData  = weightData.map((d:any) => d.weight);
    const minW   = Math.min(...wData) - 0.5;
    const maxW   = Math.max(...wData) + 0.5;
    const wRange = maxW - minW || 1;
    const W = 360, H = 170, pad = 32;

    const pts = weightData.map((d:any, i:number) => ({
      x: pad + (i / (weightData.length - 1)) * (W - pad * 2),
      y: H - pad - ((d.weight    - minW) / wRange) * (H - pad * 2),
    }));
    const avgPts = weightData.map((d:any, i:number) => ({
      x: pad + (i / (weightData.length - 1)) * (W - pad * 2),
      y: H - pad - ((d.movingAvg - minW) / wRange) * (H - pad * 2),
    }));
    const polyline = (p: {x:number,y:number}[]) => p.map((pt,i) => `${i===0?'M':'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    // Area under moving average
    const areaPath = polyline(avgPts) + ` L${avgPts[avgPts.length-1].x.toFixed(1)},${H-pad} L${avgPts[0].x.toFixed(1)},${H-pad} Z`;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:170, overflow:'visible' }}>
        <defs>
          <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0,0.25,0.5,0.75,1].map(p => {
          const y = H - pad - p * (H - pad * 2);
          return <line key={p} x1={pad} y1={y} x2={W-pad} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4" />;
        })}
        <path d={areaPath} fill="url(#wgrad)" />
        <path d={polyline(avgPts)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <path d={polyline(pts)}    fill="none" stroke="var(--text2)" strokeWidth="1.5" strokeDasharray="3,3" strokeLinecap="round" opacity="0.7" />
        {pts.map((p,i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill="var(--accent)" stroke="var(--bg)" strokeWidth="1.5" />
        ))}
        <text x={pad-6} y={pad+4}   fontSize="10" fill="var(--text2)" textAnchor="end">{maxW.toFixed(1)}</text>
        <text x={pad-6} y={H-pad+4} fontSize="10" fill="var(--text2)" textAnchor="end">{minW.toFixed(1)}</text>
        {/* First / last date labels */}
        <text x={pad} y={H-pad+16} fontSize="10" fill="var(--text3)" textAnchor="start">{weightData[0].date.slice(5)}</text>
        <text x={W-pad} y={H-pad+16} fontSize="10" fill="var(--text3)" textAnchor="end">{weightData[weightData.length-1].date.slice(5)}</text>
      </svg>
    );
  };

  // ── Calories bar chart (target vs actual) ──────────────────
  const renderCaloriesChart = () => {
    const series: DailyPoint[] = (dailySeries || []).slice(-14);
    if (series.length === 0) return <div style={{ padding:20, textAlign:'center', color:'var(--text2)', fontSize:12 }}>暂无数据</div>;
    const maxVal = Math.max(...series.map(d => Math.max(d.calories, d.targetCalories))) * 1.1;
    const W = 360, H = 170, pad = 32;
    const barW = (W - pad * 2) / series.length * 0.6;
    const gap  = (W - pad * 2) / series.length;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:170 }}>
        {[0,0.5,1].map(p => {
          const y = H - pad - p * (H - pad * 2);
          return <line key={p} x1={pad} y1={y} x2={W-pad} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4" />;
        })}
        {series.map((d, i) => {
          const x = pad + i * gap + (gap - barW) / 2;
          const h = (d.calories / maxVal) * (H - pad * 2);
          const targetY = H - pad - (d.targetCalories / maxVal) * (H - pad * 2);
          const over = d.calories > d.targetCalories * 1.05;
          return (
            <g key={i}>
              <rect x={x} y={H - pad - h} width={barW} height={h} fill={over ? 'var(--warn)' : 'var(--accent)'} rx="2" opacity="0.85" />
              <line x1={x-2} y1={targetY} x2={x+barW+2} y2={targetY} stroke="var(--text2)" strokeWidth="1.5" strokeDasharray="2,2" />
            </g>
          );
        })}
        <text x={pad-6} y={pad+4} fontSize="10" fill="var(--text2)" textAnchor="end">{Math.round(maxVal)}</text>
        <text x={pad-6} y={H-pad+4} fontSize="10" fill="var(--text2)" textAnchor="end">0</text>
        <text x={pad} y={H-pad+16} fontSize="9" fill="var(--text3)" textAnchor="start">{series[0].date.slice(5)}</text>
        <text x={W-pad} y={H-pad+16} fontSize="9" fill="var(--text3)" textAnchor="end">{series[series.length-1].date.slice(5)}</text>
      </svg>
    );
  };

  // ── Macro stacked trend (last 14 days, % of calories) ──────
  const renderMacrosChart = () => {
    const series: DailyPoint[] = (dailySeries || []).slice(-14).filter(d => (d.carbs + d.protein + d.fat) > 0);
    if (series.length === 0) return <div style={{ padding:20, textAlign:'center', color:'var(--text2)', fontSize:12 }}>暂无数据</div>;
    const W = 360, H = 170, pad = 32;
    const bandW = (W - pad * 2) / series.length;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:170 }}>
        {series.map((d, i) => {
          const totalKcal = d.carbs*4 + d.protein*4 + d.fat*9;
          const carbH   = (d.carbs*4   / totalKcal) * (H - pad * 2);
          const protH   = (d.protein*4 / totalKcal) * (H - pad * 2);
          const fatH    = (d.fat*9     / totalKcal) * (H - pad * 2);
          const x = pad + i * bandW;
          return (
            <g key={i}>
              <rect x={x+1} y={pad}                       width={bandW-2} height={carbH} fill="var(--ring-carb)" opacity="0.9" />
              <rect x={x+1} y={pad+carbH}                 width={bandW-2} height={protH} fill="var(--ring-protein)" opacity="0.9" />
              <rect x={x+1} y={pad+carbH+protH}           width={bandW-2} height={fatH}  fill="var(--ring-fat)" opacity="0.9" />
            </g>
          );
        })}
        <text x={pad} y={H-pad+16} fontSize="9" fill="var(--text3)" textAnchor="start">{series[0].date.slice(5)}</text>
        <text x={W-pad} y={H-pad+16} fontSize="9" fill="var(--text3)" textAnchor="end">{series[series.length-1].date.slice(5)}</text>
      </svg>
    );
  };

  return (
    <>
      {/* Top Nav Bar */}
      <div className="nav-bar">
        <div className="nav-inner">
          <a href="/app" className="nav-brand">
            📊 动态减脂
          </a>
          <div className="nav-links">
            <a href="/app" className="nav-link">📊 追踪</a>
            <a href="/analytics" className="nav-link active">📈 分析</a>
          </div>
          <div className="nav-actions">
            <button onClick={exportCSV} className="btn-secondary" style={{fontSize:12, padding:'6px 12px'}}>
              <DownloadSimple size={14} /> 导出 CSV
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Title */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div>
            <h2 style={{fontSize:20,fontWeight:700,color:'var(--text)'}}>数据分析</h2>
            <div style={{fontSize:13,color:'var(--text2)',marginTop:2}}>{daysLogged} 天记录</div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="s-label">起始体重</div>
            <div className="s-value">{startWeight}<span style={{ fontSize:11, fontWeight:400, color:'var(--text2)' }}> kg</span></div>
          </div>
          <div className="stat-card">
            <div className="s-label">当前体重</div>
            <div className="s-value">{currentWeight}<span style={{ fontSize:11, fontWeight:400, color:'var(--text2)' }}> kg</span></div>
          </div>
          <div className="stat-card">
            <div className="s-label">总变化</div>
            <div className={`s-value ${lossClass}`} style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
              {totalLossNum > 0 ? <TrendDown size={16} /> : totalLossNum < 0 ? <TrendUp size={16} /> : <Minus size={16} />}
              {totalLossNum > 0 ? '-' : totalLossNum < 0 ? '+' : ''}{totalLossAbs}
              <span style={{ fontSize:11, fontWeight:400, color:'var(--text2)' }}>kg</span>
            </div>
          </div>
        </div>

        {/* Secondary stats */}
        <div className="stats-row" style={{ marginTop:8 }}>
          <div className="stat-card">
            <div className="s-label">周变化速率</div>
            <div className="s-value" style={{ fontSize:16 }}>
              {weeklyRate !== null ? `${weeklyRate > 0 ? '-' : weeklyRate < 0 ? '+' : ''}${Math.abs(weeklyRate)} kg/周` : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="s-label">记录天数</div>
            <div className="s-value" style={{ fontSize:16 }}>{daysLogged}<span style={{ fontSize:11, color:'var(--text2)' }}> 天</span></div>
          </div>
          <div className="stat-card">
            <div className="s-label">目标达成率</div>
            <div className="s-value" style={{ fontSize:16, color:'var(--accent)' }}>
              {goalRate != null ? `${goalRate}%` : '—'}
            </div>
          </div>
        </div>

        {/* Chart mode switcher */}
        <div className="chart-tabs">
          {([
            { key:'weight',   label:'体重趋势' },
            { key:'calories', label:'热量 vs 目标' },
            { key:'macros',   label:'宏观结构' },
          ] as const).map(m => (
            <button
              key={m.key}
              onClick={() => setChartMode(m.key)}
              className={`chart-tab${chartMode===m.key ? ' active' : ''}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Chart Card */}
        <div className="card">
          {chartMode === 'weight' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>体重趋势</h3>
                <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text2)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:18, height:2, background:'var(--text2)', borderRadius:1 }} />
                    每日体重
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:18, height:2, background:'var(--accent)', borderRadius:1 }} />
                    7 日均值
                  </div>
                </div>
              </div>
              {renderWeightChart()}
            </>
          )}
          {chartMode === 'calories' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>每日热量 vs 目标 (近 14 天)</h3>
                <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text2)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:10, height:10, background:'var(--accent)', borderRadius:2 }} />
                    实际
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:14, height:2, background:'var(--text2)' }} />
                    目标
                  </div>
                </div>
              </div>
              {renderCaloriesChart()}
            </>
          )}
          {chartMode === 'macros' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>每日宏观结构 (近 14 天)</h3>
                <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--text2)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ width:10, height:10, background:'var(--ring-carb)', borderRadius:2 }} />
                    碳水
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ width:10, height:10, background:'var(--ring-protein)', borderRadius:2 }} />
                    蛋白
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ width:10, height:10, background:'var(--ring-fat)', borderRadius:2 }} />
                    脂肪
                  </div>
                </div>
              </div>
              {renderMacrosChart()}
            </>
          )}
        </div>

        {/* Macro Distribution */}
        <div className="card">
          <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:14 }}>近 7 天平均摄入</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'碳水', value: macroPercentages?.carbs   || 0, color:'var(--ring-carb)' },
              { label:'蛋白', value: macroPercentages?.protein || 0, color:'var(--ring-protein)' },
              { label:'脂肪', value: macroPercentages?.fat     || 0, color:'var(--ring-fat)' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                  <span>{item.label}</span>
                  <span style={{ color:item.color, fontWeight:600 }}>{item.value}%</span>
                </div>
                <div style={{ height:8, background:'var(--bg3)', borderRadius:'var(--radius-pill)', overflow:'hidden' }}>
                  <div style={{ width:`${item.value}%`, height:'100%', background:item.color, borderRadius:'var(--radius-pill)', transition:'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, textAlign:'center' }}>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--ring-carb)' }}>{macroTotal?.carbs||0}g</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>碳水</div>
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--ring-protein)' }}>{macroTotal?.protein||0}g</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>蛋白</div>
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--ring-fat)' }}>{macroTotal?.fat||0}g</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>脂肪</div>
            </div>
          </div>
        </div>

        {/* Weight Log */}
        <div className="card">
          <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:12 }}>体重记录</h3>
          {weightData && weightData.length > 0 ? (
            <div style={{ maxHeight:200, overflowY:'auto' }}>
              {[...weightData].reverse().map((d:any, i:number) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                  <span style={{ color:'var(--text2)' }}>{d.date}</span>
                  <span style={{ fontWeight:600 }}>{d.weight} kg</span>
                  <span style={{ fontSize:10, color:'var(--text3)' }}>均: {d.movingAvg}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:20, color:'var(--text2)', fontSize:12 }}>尚无体重记录</div>
          )}
        </div>
      </div>

      {/* Bottom Nav — mobile only */}
      <div className="bottom-nav">
        <a href="/app"      className="bottom-nav-item">
          <ChartBar size={18} />追踪
        </a>
        <a href="/analytics" className="bottom-nav-item active">
          <ChartLineDown size={18} />分析
        </a>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
