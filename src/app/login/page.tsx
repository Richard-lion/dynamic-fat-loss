'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Scales, User, Lock, ArrowRight } from '@phosphor-icons/react';

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px 16px',
    }}>
      {/* Brand Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 72, height: 72,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
          borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
        }}>
          <Scales size={36} color="#fff" weight="duotone" />
        </div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.3px',
          marginBottom: 6,
        }}>
          动态减脂拉锯战
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
          告别固定热量，10 天智能调整<br />
          科学减脂，不再焦虑
        </p>
      </div>

      {/* Error */}
      {error && <div className="error-box">{error}</div>}

      {/* Card */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420 }}>
        <div className="card login-card" style={{ marginBottom: 16 }}>
          {/* Tabs */}
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

          {/* Fields */}
          <div className="login-fields">
            <div className="form-group">
              <label>用户名</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="var(--text3)" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="输入用户名"
                  autoComplete="username"
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>密码</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text3)" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="输入密码"
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            {tab === 'register' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>确认密码</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="var(--text3)" style={{ position: 'absolute', left: 14, top: 14 }} />
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    style={{ paddingLeft: 40 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? '处理中...' : tab === 'login' ? (
            <>登录 <ArrowRight size={18} /></>
          ) : (
            <>创建账户 <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      {/* Footer */}
      <p style={{
        fontSize: 12,
        color: 'var(--text3)',
        textAlign: 'center',
        marginTop: 32,
        lineHeight: 1.6,
        maxWidth: 320,
      }}>
        本应用之营养素推荐仅供健康管理的数据记录参考，不构成医疗建议。
      </p>
    </div>
  );
}
