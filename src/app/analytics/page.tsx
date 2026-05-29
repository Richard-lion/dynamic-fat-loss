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

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

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

  const { weightData, macroTotal, macroPercentages, startWeight, currentWeight } = data;
  const totalLossNum  = parseFloat((startWeight - currentWeight).toFixed(1));
  const lossClass     = totalLossNum > 0 ? 'down' : totalLossNum < 0 ? 'up' : '';
  const totalLossAbs  = Math.abs(totalLossNum);

  const renderWeightChart = () => {
    if (!weightData || weightData.length < 2) {
      return (
        <div style={{ height:150, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
          <div style={{ fontSize:40 }}>📊</div>
          <div style={{ fontSize:13, color:'var(--text2)' }}>至少需要 2 天体重数据</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>持续记录后就会显示趋势图</div>
        </div>
      );
    }
    const wData  = weightData.map((d:any) => d.weight);
    const minW   = Math.min(...wData) - 1;
    const maxW   = Math.max(...wData) + 1;
    const wRange = maxW - minW || 1;
    const W = 360, H = 150, pad = 28;

    const pts = weightData.map((d:any, i:number) => ({
      x: pad + (i / (weightData.length - 1)) * (W - pad * 2),
      y: H - pad - ((d.weight    - minW) / wRange) * (H - pad * 2),
    }));
    const avgPts = weightData.map((d:any, i:number) => ({
      x: pad + (i / (weightData.length - 1)) * (W - pad * 2),
      y: H - pad - ((d.movingAvg - minW) / wRange) * (H - pad * 2),
    }));
    const polyline = (p: {x:number,y:number}[]) => p.map((pt,i) => `${i===0?'M':'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:150, overflow:'visible' }}>
        {[0,0.25,0.5,0.75,1].map(p => {
          const y = H - pad - p * (H - pad * 2);
          return <line key={p} x1={pad} y1={y} x2={W-pad} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4" />;
        })}
        <path d={polyline(avgPts)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5,3" strokeLinecap="round" />
        <path d={polyline(pts)}    fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" />
        {pts.map((p,i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5" fill="var(--accent)" />
        ))}
        <text x={pad-6} y={pad+4}   fontSize="10" fill="var(--text2)" textAnchor="end">{maxW.toFixed(1)}</text>
        <text x={pad-6} y={H-pad+4} fontSize="10" fill="var(--text2)" textAnchor="end">{minW.toFixed(1)}</text>
      </svg>
    );
  };

  return (
    <>
      <div className="container">
        {/* Header */}
        <div className="header">
          <div>
            <h1 style={{ fontSize:18, fontWeight:700, color:'var(--text)', letterSpacing:-0.2px }}>
            数据分析
          </h1>
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
            <div className={`s-value ${lossClass}`}>
              {totalLossNum > 0 ? '-' : totalLossNum < 0 ? '+' : ''}{totalLossAbs}
              <span style={{ fontSize:11, fontWeight:400, color:'var(--text2)' }}> kg</span>
            </div>
          </div>
        </div>

        {/* Weight Chart */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>📉 体重趋势</h3>
            <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:18, height:2, background:'var(--text2)', borderRadius:1 }} />
                每日体重
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:18, height:2, background:'var(--accent)', borderRadius:1, borderBottom:'2px dashed var(--accent)' }} />
                移动平均
              </div>
            </div>
          </div>
          {renderWeightChart()}
        </div>

        {/* Macro Distribution */}
        <div className="card">
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>🥗 饮食结构（近 7 天）</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'碳水', value: macroPercentages?.carbs   || 0, color:'var(--accent)' },
              { label:'蛋白', value: macroPercentages?.protein || 0, color:'#3a9e6e' },
              { label:'脂肪', value: macroPercentages?.fat     || 0, color:'#d4880a' },
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
              <div style={{ fontSize:20, fontWeight:700, color:'var(--accent)' }}>{macroTotal?.carbs||0}g</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>碳水</div>
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:'#3a9e6e' }}>{macroTotal?.protein||0}g</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>蛋白</div>
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:'#d4880a' }}>{macroTotal?.fat||0}g</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>脂肪</div>
            </div>
          </div>
        </div>

        {/* Weight Log */}
        <div className="card">
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>📋 体重记录</h3>
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

      {/* Bottom Nav */}
      <div className="nav-bar">
        <a href="/app"      className="nav-item">
          <span className="nav-icon">📊</span>追踪
        </a>
        <a href="/analytics" className="nav-item active">
          <span className="nav-icon">📈</span>分析
        </a>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
