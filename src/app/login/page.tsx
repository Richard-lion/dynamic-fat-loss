'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = '/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('fl_token');
    if (token) router.replace('/');
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
      // Set cookie for middleware auth — path=/ so it covers /app, /analytics, etc.
      document.cookie = `fl_token=${data.token}; path=/; Max-Age=604800; SameSite=Lax`;
      // Hard navigation to dashboard — client-side check handles onboarding redirect
      window.location.href = '/app';
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
      // Set cookie for middleware auth — path=/ so it covers /app, /analytics, etc.
      document.cookie = `fl_token=${data.token}; path=/; Max-Age=604800; SameSite=Lax`;
      // Hard navigation to dashboard — client-side check handles onboarding redirect
      window.location.href = '/app';
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
      {/* Hero */}
      <div className="onboarding-hero">
        <div style={{ fontSize: 52, marginBottom: 10 }}>⚖️</div>
        <h1 style={{ fontSize: 26 }}>动态减脂拉锯战</h1>
        <p>登录你的账户<br />开始科学减脂之旅</p>
      </div>

      {error && <div className="error-box">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card login-card">
          {/* Tab Switcher — embedded in card, no floating gap */}
          <div className="login-tabs">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(''); }}
                className={`login-tab${tab === t ? ' active' : ''}`}
              >
                {t === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <div className="login-fields">
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="输入用户名"
                autoComplete={tab === 'register' ? 'username' : 'username'}
              />
            </div>

            <div className="form-group" style={{ marginBottom: tab === 'register' ? 14 : 0 }}>
              <label>密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="输入密码"
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              />
            </div>

            {tab === 'register' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>确认密码</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '处理中...' : tab === 'login' ? '登录' : '创建账户'}
        </button>
      </form>
    </div>
  );
}
