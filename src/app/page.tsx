'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const WORKOUT_LEVELS = [
  { value: '2-3', label: '每周 2 次', sub: '约 2-3 小时/周' },
  { value: '4-5', label: '每周 3 次', sub: '约 4-5 小时/周' },
  { value: '6-7', label: '每周 4 次', sub: '约 6-7 小时/周' },
  { value: '8-9', label: '每周 5 次', sub: '约 8-9 小时/周' },
];

const DURATIONS = [
  { value: 30, label: '30', sub: '1 个月' },
  { value: 60, label: '60', sub: '2 个月' },
  { value: 90, label: '90', sub: '3 个月' },
];

function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('fl_token');
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [workoutLevel, setWorkoutLevel] = useState('');
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('fl_token');
    if (token) {
      // Has localStorage token — validate it
      const checkUser = async () => {
        try {
          const res = await apiFetch('/api/dashboard');
          if (res.ok) { router.push('/app'); return; }
          // Token invalid — fall through to cookie check
        } catch {}
        tryLocalStorageFallback();
      };
      checkUser();
    } else {
      // No localStorage (private window) — try cookie session
      (async () => {
        const cookieRes = await fetch('/api/auth/session');
        if (cookieRes.ok) {
          const data = await cookieRes.json();
          localStorage.setItem('fl_token', data.token);
          const dashRes = await fetch('/api/dashboard', {
            headers: { Authorization: `Bearer ${data.token}` },
          });
          if (dashRes.ok) { router.push('/app'); return; }
          // Cookie valid, no onboarding → stay on this page
          setLoading(false);
          return;
        }
        // No cookie session — go to login
        setLoading(false);
        router.push('/login');
      })();
    }
  }, [router]);

  const tryLocalStorageFallback = async () => {
    const cookieRes = await fetch('/api/auth/session');
    if (cookieRes.ok) {
      const data = await cookieRes.json();
      localStorage.setItem('fl_token', data.token);
      const dashRes = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (dashRes.ok) { router.push('/app'); return; }
      setLoading(false);
      return;
    }
    setLoading(false);
    router.push('/login');
  };

  if (loading) return (
    <div className="loading-screen page-enter">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 52, marginBottom: 8, animation: 'ringPop 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>⚖️</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>动态减脂拉锯战</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <div className="skeleton skeleton-text short" />
          <div className="skeleton skeleton-text medium" />
          <div className="spinner" style={{ marginTop: 8 }} />
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>加载中...</div>
        </div>
      </div>
    </div>
  );

  const canProceed = () => {
    if (step === 1) return gender !== '';
    if (step === 2) return weight !== '' && parseFloat(weight) > 30 && parseFloat(weight) < 300;
    if (step === 3) return workoutLevel !== '';
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (step < 3) { setStep(step + 1); return; }
    submit();
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          gender, weight: parseFloat(weight),
          workoutLevel, totalDurationDays: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '初始化失败');
      router.push('/app');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="container page-enter">
      {/* Hero */}
      <div className="onboarding-hero">
        <div style={{ fontSize: 52, marginBottom: 10, animation: 'ringPop 0.55s cubic-bezier(0.22,1,0.36,1) both' }}>⚖️</div>
        <h1>动态减脂拉锯战</h1>
        <p>告别固定热量的瓶颈<br />用 10 天周期科学调整营养目标</p>
      </div>

      {error && <div className="error-box toast-enter">{error}</div>}

      {/* Step Progress */}
      <div className="step-dots" style={{ animation: 'pageEnter 0.32s 0.05s cubic-bezier(0.22,1,0.36,1) both' }}>
        {[1, 2, 3].map(s => (
          <div key={s} className={`step-dot ${s < step ? 'done' : s === step ? 'active' : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>STEP 1 / 3</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>你的性别是？</h3>
          <div className="gender-toggle">
            <div className={`gender-btn ${gender === 'male' ? 'active' : ''}`} onClick={() => setGender('male')}>
              <span className="g-icon">♂</span>
              男性
            </div>
            <div className={`gender-btn ${gender === 'female' ? 'active' : ''}`} onClick={() => setGender('female')}>
              <span className="g-icon">♀</span>
              女性
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>STEP 2 / 3</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>目前体重（kg）</h3>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              type="number"
              min="30" max="300" step="0.1"
              placeholder="例如：68.5"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              style={{ fontSize: 30, textAlign: 'center', fontWeight: 700, padding: '16px' }}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginTop: 10 }}>
            营养目标会以这个体重为基础计算
          </p>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="card">
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>STEP 3 / 3</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>每周运动多久？</h3>
            <div className="workout-options">
              {WORKOUT_LEVELS.map(w => (
                <div
                  key={w.value}
                  className={`workout-btn ${workoutLevel === w.value ? 'active' : ''}`}
                  onClick={() => setWorkoutLevel(w.value)}
                >
                  <span className="w-main">{w.label}</span>
                  <span className="w-sub">{w.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>计划时长</h3>
            <div className="duration-options">
              {DURATIONS.map(d => (
                <div
                  key={d.value}
                  className={`duration-btn ${duration === d.value ? 'active' : ''}`}
                  onClick={() => setDuration(d.value)}
                >
                  <span className="d-num">{d.label}</span>
                  <span className="d-label">{d.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <button className="btn-primary" onClick={handleNext} disabled={!canProceed() || loading}>
        {loading ? '建立中...' : step < 3 ? '下一步 →' : '开始减脂计划 🚀'}
      </button>

      {step > 1 && (
        <button
          className="btn-ghost"
          onClick={() => setStep(step - 1)}
          style={{ display: 'block', width: '100%', marginTop: 8, textAlign: 'center' }}
        >
          ← 上一步
        </button>
      )}
    </div>
  );
}
