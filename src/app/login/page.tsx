'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = '/api/auth';

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

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect to app
  useEffect(() => {
    const token = localStorage.getItem('fl_token');
    if (token) router.replace('/app');
  }, [router]);

  const handleRegister = async () => {
    if (!username || !password) { setError('请填写所有字段'); return; }
    if (password !== confirmPwd) { setError('两次密码不一致'); return; }
    if (password.length < 6) { setError('密码至少 6 个字符'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注册失败');

      localStorage.setItem('fl_token', data.token);
      localStorage.setItem('fl_userId', data.userId);
      localStorage.setItem('fl_username', username);
      router.push('/');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) { setError('请填写所有字段'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登录失败');

      localStorage.setItem('fl_token', data.token);
      localStorage.setItem('fl_userId', data.userId);
      localStorage.setItem('fl_username', username);

      // Check if user has completed onboarding
      const stateRes = await apiFetch('/api/dashboard');
      if (stateRes.status === 401) {
        // Onboarding not done — go to onboarding
        router.push('/');
      } else {
        router.push('/app');
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'register') handleRegister();
    else handleLogin();
  };

  return (
    <div className="container" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 60 }}>
      <div className="onboarding-hero" style={{ marginBottom: 28 }}>
        <div className="icon">⚖️</div>
        <h1>动态减脂拉锯战</h1>
        <p>登录你的账户<br />开始科学减脂之旅</p>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg2)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
        {(['login', 'register'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text2)',
            }}
          >
            {t === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="onboarding-card">
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="输入用户名"
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 15,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              autoComplete={tab === 'register' ? 'username' : 'username'}
            />
          </div>

          <div className="form-group" style={{ marginBottom: tab === 'register' ? 14 : 0 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="输入密码"
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 15,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          {tab === 'register' && (
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>确认密码</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="再次输入密码"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: 15,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                autoComplete="new-password"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ width: '100%', marginTop: 8 }}
        >
          {loading ? '处理中...' : tab === 'login' ? '登录' : '创建账户'}
        </button>
      </form>

      {tab === 'login' && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text2)', marginTop: 20 }}>
          还没有账户？<button onClick={() => setTab('register')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0 }}>立即注册</button>
        </p>
      )}
    </div>
  );
}