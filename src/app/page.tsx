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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If not logged in, redirect to login
  useEffect(() => {
    const token = localStorage.getItem('fl_token');
    if (!token) {
      router.push('/login');
      return;
    }
    // If logged in, check if onboarded
    const checkUser = async () => {
      try {
        const res = await apiFetch('/api/dashboard');
        if (res.ok) {
          router.push('/app'); // Already onboarded → go to dashboard
        }
        // Otherwise (401) → stay on onboarding to set up data
      } catch {
        // Stay on onboarding
      }
    };
    checkUser();
  }, [router]);

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
          gender,
          weight: parseFloat(weight),
          workoutLevel,
          totalDurationDays: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '初始化失败');

      // Token already stored by login/register — just navigate
      router.push('/app');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="onboarding-hero">
        <div className="icon">⚖️</div>
        <h1>动态减脂拉锯战</h1>
        <p>告别固定热量的瓶颈<br />用 10 天周期科学调整营养目标</p>
      </div>

      {error && (
        <div className="error-box">{error}</div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? 'var(--accent)' : 'var(--bg3)' }} />
        ))}
      </div>

      {step === 1 && (
        <div className="onboarding-card">
          <div className="step-num">STEP 1 / 3</div>
          <h3>你的性别是？</h3>
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
        <div className="onboarding-card">
          <div className="step-num">STEP 2 / 3</div>
          <h3>目前体重（kg）</h3>
          <div className="form-group">
            <input
              type="number"
              min="30"
              max="300"
              step="0.1"
              placeholder="例如：68.5"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              style={{ fontSize: 28, textAlign: 'center', fontWeight: 700, width: '100%' }}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginTop: 8 }}>
            营养目标会以这个体重为基础计算
          </p>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="onboarding-card">
            <div className="step-num">STEP 3 / 3</div>
            <h3>每周运动多久？</h3>
            <div className="workout-options">
              {WORKOUT_LEVELS.map(w => (
                <div
                  key={w.value}
                  className={`workout-btn ${workoutLevel === w.value ? 'active' : ''}`}
                  onClick={() => setWorkoutLevel(w.value)}
                >
                  <div style={{ fontWeight: 600 }}>{w.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{w.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="onboarding-card">
            <h3>计划时长</h3>
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
          onClick={() => setStep(step - 1)}
          style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, marginTop: 12, cursor: 'pointer', display: 'block', width: '100%' }}
        >
          ← 上一步
        </button>
      )}
    </div>
  );
}