'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = '/api/auth';

function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, validate }: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  autoComplete: string; validate?: (v: string) => string;
}) {
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState(false);
  const validationMsg = validate ? validate(value) : '';
  const isValid = value && !validationMsg;
  const isError = touched && !!validationMsg;
  return (
    <div className="form-group" style={{ marginBottom: 14 }}>
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={showPw ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={isValid ? 'valid' : isError ? 'error' : ''}
          style={{ paddingRight: 42 }}
        />
        <button
          type="button"
          onClick={() => setShowPw(v => !v)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--text2)', padding: 4,
          }}
          aria-label={showPw ? '隐藏密码' : '显示密码'}
        >
          {showPw ? '🙈' : '👁️'}
        </button>
      </div>
      {isError && (
        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{validationMsg}</div>
      )}
    </div>
  );
}

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
      window.location.href = '/';
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
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (tab === 'register') handleRegister();
    else handleLogin();
  };

  const tabIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: 4, left: 4,
    height: 'calc(100% - 8px)',
    width: 'calc(50% - 4px)',
    background: 'var(--bg2)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-card)',
    transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), width 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
    zIndex: 0,
    transform: tab === 'login' ? 'translateX(0)' : 'translateX(calc(100% + 4px))',
  };

  return (
    <div className="container page-enter" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 60 }}>
      {/* Hero */}
      <div className="onboarding-hero login-hero-bg">
        <div style={{ fontSize: 52, marginBottom: 10, animation: 'ringPop 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>⚖️</div>
        <h1 style={{ fontSize: 26 }}>动态减脂拉锯战</h1>
        <p>登录你的账户<br />开始科学减脂之旅</p>
      </div>

      {error && <div className="error-box toast-enter">{error}</div>}

      {/* Tab Switcher */}
      <div style={{ position: 'relative', marginBottom: 20, background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: 4, border: '1px solid var(--border)' }}>
        <div style={tabIndicatorStyle} />
        {(['login', 'register'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); }}
            style={{
              position: 'relative', zIndex: 1,
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              background: 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text2)',
              transition: 'color 0.18s',
            }}
          >
            {t === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="stagger-child">
        <div className="card">
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="输入用户名"
              autoComplete={tab === 'register' ? 'username' : 'username'}
              className={username.length > 0 && username.length < 2 ? 'error' : username.length >= 2 ? 'valid' : ''}
            />
            {username.length > 0 && username.length < 2 && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>用户名至少 2 个字符</div>
            )}
          </div>

          <PasswordInput
            id="password"
            label="密码"
            value={password}
            onChange={setPassword}
            placeholder="输入密码"
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            validate={v => v.length > 0 && v.length < 6 ? '密码至少 6 个字符' : ''}
          />

          {tab === 'register' && (
            <PasswordInput
              id="confirmPwd"
              label="确认密码"
              value={confirmPwd}
              onChange={setConfirmPwd}
              placeholder="再次输入密码"
              autoComplete="new-password"
              validate={v => v !== password && v.length > 0 ? '两次密码不一致' : ''}
            />
          )}
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block', width: 16, height: 16,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              处理中...
            </span>
          ) : tab === 'login' ? '登录' : '创建账户'}
        </button>
      </form>

      {tab === 'login' && (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginTop: 20 }}>
          还没有账户？{' '}
          <button
            onClick={() => setTab('register')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}
          >
            立即注册
          </button>
        </p>
      )}
    </div>
  );
}
