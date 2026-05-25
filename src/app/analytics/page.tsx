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
    } catch (e: any) {
      setToast('载入失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text2)', fontSize: 14 }}>
      载入中...
    </div>
  );

  if (!data) return (
    <div style={{ padding: '12px 14px 90px', maxWidth: 480, margin: '0 auto' }}>
      <p style={{ color: 'var(--text2)', textAlign: 'center', marginTop: 40, fontSize: 13 }}>
        {toast || '载入失败，请返回重新尝试'}
      </p>
    </div>
  );

  const { weightData, macroTotal, macroPercentages, startWeight, currentWeight } = data;

  const totalLossNum = parseFloat((startWeight - currentWeight).toFixed(1));
  const lossClass = totalLossNum > 0 ? 'down' : totalLossNum < 0 ? 'up' : '';
  const totalLossAbs = Math.abs(totalLossNum);

  const renderWeightChart = () => {
    if (!weightData || weightData.length < 2) {
      return (
        <div style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <div>至少需要 2 天体重数据</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>持续记录后就会显示趋势图</div>
        </div>
      );
    }

    const wData = weightData.map((d: any) => d.weight);
    const minW = Math.min(...wData) - 1;
    const maxW = Math.max(...wData) + 1;
    const wRange = maxW - minW || 1;
    const W = 340;
    const H = 140;
    const pad = 24;

    const points = weightData.map((d: any, i: number) => ({
      x: pad + (i / (weightData.length - 1)) * (W - pad * 2),
      y: H - pad - ((d.weight - minW) / wRange) * (H - pad * 2),
    }));

    const avgPoints = weightData.map((d: any, i: number) => ({
      x: pad + (i / (weightData.length - 1)) * (W - pad * 2),
      y: H - pad - ((d.movingAvg - minW) / wRange) * (H - pad * 2),
    }));

    const polyline = (pts: {x: number, y: number}[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 140, overflow: 'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = H - pad - p * (H - pad * 2);
          return <line key={p} x1={pad} y1={y} x2={W - pad} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4" />;
        })}
        <path d={polyline(points)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={polyline(avgPoints)} fill="none" stroke="var(--accent2)" strokeWidth="2" strokeDasharray="5,3" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill="var(--accent)" />
        ))}
        <text x={pad - 4} y={pad + 4} fontSize="10" fill="var(--text2)" textAnchor="end">{maxW.toFixed(1)}</text>
        <text x={pad - 4} y={H - pad + 4} fontSize="10" fill="var(--text2)" textAnchor="end">{minW.toFixed(1)}</text>
      </svg>
    );
  };

  return (
    <>
      <div style={{ padding: '12px 14px 90px', maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 14px' }}>
          <div>
            <h1 style={{ fontSize: 18 }}>📈 数据分析</h1>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>追踪你的减脂进度</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text2)' }}>起始体重</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{startWeight} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text2)' }}>kg</span></div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text2)' }}>当前体重</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{currentWeight} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text2)' }}>kg</span></div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text2)' }}>总变化</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: lossClass === 'down' ? 'var(--accent2)' : lossClass === 'up' ? 'var(--danger)' : 'var(--text2)' }}>
              {totalLossNum > 0 ? '-' : totalLossNum < 0 ? '+' : ''}{totalLossAbs}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10, fontWeight: 500 }}>📉 体重趋势</h3>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 11, color: 'var(--text2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 18, height: 2, background: 'var(--accent)', borderRadius: 1 }} />
              每日体重
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 18, height: 2, background: 'var(--accent2)', borderRadius: 1, borderBottom: '2px dashed var(--accent2)' }} />
              移动平均
            </div>
          </div>
          {renderWeightChart()}
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, fontWeight: 500 }}>🥗 饮食结构（近 7 天）</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: '碳水', value: macroPercentages?.carbs || 0, color: 'var(--accent2)' },
              { label: '蛋白', value: macroPercentages?.protein || 0, color: 'var(--accent)' },
              { label: '脂肪', value: macroPercentages?.fat || 0, color: '#f0a030' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{item.label}</span>
                  <span style={{ color: item.color }}>{item.value}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${item.value}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>{macroTotal?.carbs || 0}g</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>碳水</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{macroTotal?.protein || 0}g</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>蛋白</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0a030' }}>{macroTotal?.fat || 0}g</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>脂肪</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, fontWeight: 500 }}>📋 体重记录</h3>
          {weightData && weightData.length > 0 ? (
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {[...weightData].reverse().map((d: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text2)' }}>{d.date}</span>
                  <span style={{ fontWeight: 600 }}>{d.weight} kg</span>
                  <span style={{ fontSize: 10, color: 'var(--text2)' }}>均: {d.movingAvg}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text2)', fontSize: 12 }}>尚无体重记录</div>
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
        <a href="/app" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', color: 'var(--text2)', textDecoration: 'none', fontSize: 10 }}>
          <span style={{ fontSize: 20 }}>📊</span>
          追踪
        </a>
        <a href="/analytics" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', color: 'var(--accent)', textDecoration: 'none', fontSize: 10 }}>
          <span style={{ fontSize: 20 }}>📈</span>
          分析
        </a>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'none', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 20px', fontSize: 13, zIndex: 200, animation: 'fadeIn 0.3s ease', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </>
  );
}