'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { homeFor, useAuth } from '@/hooks/useAuth';
import { useNav } from '@/hooks/useNav';
import SupportForm from '@/components/SupportForm';
import { useT } from '@/utils/locale';

interface AuthProps {
  mode: 'login' | 'register';
}

const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

/** Only same-site paths are accepted as the post-login destination. */
const safeNext = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : null);

export default function Auth({ mode }: AuthProps) {
  const { navigate, dark, toggleDark } = useNav();
  const t = useT();
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(mode);
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const auth = useAuth();
  const router = useRouter();

  // ?error=… comes back from a failed Google sign-in; ?next=… from a protected page.
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setNext(safeNext(params.get('next')));
      if (params.get('error')) setError(params.get('error')!);
    });
    authApi.googleStatus().then(s => setGoogleEnabled(s.enabled), () => setGoogleEnabled(false));
  }, []);

  // Already signed in: skip the form.
  useEffect(() => {
    if (auth.status === 'authenticated' && auth.user && !loading) router.replace(next ?? homeFor(auth.user));
  }, [auth.status, auth.user, loading, next, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = tab === 'register' ? await auth.register(name, email, password) : await auth.login(email, password);
      router.replace(next ?? homeFor(user));
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 16,
    outline: 'none',
    transition: 'border-color 150ms',
    fontFamily: 'inherit',
  };

  const HERO_PHOTOS = [
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=1100&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&h=1100&fit=crop&auto=format',
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Left – Photo panel (desktop only) */}
      <div style={{ flex: '0 0 52%', position: 'relative', overflow: 'hidden' }} className="sticky top-0 hidden h-screen lg:block">
        <img
          src={HERO_PHOTOS[tab === 'register' ? 1 : 0]}
          alt="Event"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'var(--border)' }}
        />
      </div>

      {/* Right – Form panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }} className="justify-start px-5 py-6 sm:justify-center sm:px-6 sm:py-12">
        {/* Top bar */}
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="mb-8 sm:mb-10">
          <button onClick={() => navigate('landing')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-2)', fontWeight: 500, padding: 0 }}>
            <ArrowLeftIcon /> Back
          </button>
          <button onClick={toggleDark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
            {dark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }} className="fade-up">

          {/* Forgot password */}
          {tab === 'forgot' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: 'var(--accent)' }}>
                <CheckCircleIcon />
              </div>
              <h2 className="font-serif" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>{t('Reset password', 'Сброс пароля')}</h2>
              <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6 }}>
                {t('Write to support from the email you signed up with — we’ll set a new password and send it to you.',
                  'Напишите в поддержку с email, на который зарегистрирован аккаунт — мы установим новый пароль и пришлём его вам.')}
                {googleEnabled && t(' If you signed up with Google, just use “Continue with Google”.', ' Если вы входили через Google, просто нажмите «Continue with Google».')}
              </p>
              <SupportForm initialEmail={email} initialTopic="password" />
              <button onClick={() => setTab('login')}
                style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 11, background: 'none', color: 'var(--text-2)', border: '1.5px solid var(--border)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                {t('Back to sign in', 'Назад ко входу')}
              </button>
            </>
          )}

          {/* Login / Register */}
          {tab !== 'forgot' && (
            <>
              <h1 className="font-serif" style={{ fontSize: 'clamp(28px, 6vw, 32px)', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
                {tab === 'login' ? 'Welcome back.' : 'Create your account.'}
              </h1>
              <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 32 }}>
                {tab === 'login' ? "Sign in to manage your events." : "Start sharing moments in minutes."}
              </p>

              {error && (
                <p role="alert" style={{ margin: '0 0 20px', padding: '12px 14px', borderRadius: 10, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>
                  {error}
                </p>
              )}

              {googleEnabled && (<>
              {/* Google button */}
              <button type="button" onClick={() => { window.location.href = authApi.googleUrl; }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 24, transition: 'background 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>or continue with email</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              </>)}

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {tab === 'register' && (
                  <div>
                    <label htmlFor="auth-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Full name</label>
                    <input id="auth-name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required
                      placeholder="Anna Ivanova" style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                  </div>
                )}
                <div>
                  <label htmlFor="auth-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Email</label>
                  <input id="auth-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="you@example.com" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label htmlFor="auth-password" style={{ fontSize: 13, fontWeight: 600 }}>Password</label>
                    {tab === 'login' && (
                      <button type="button" onClick={() => setTab('forgot')}
                        style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500, padding: 0 }}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input id="auth-password" type={showPass ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete={tab === 'register' ? 'new-password' : 'current-password'} minLength={tab === 'register' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder={tab === 'register' ? 'At least 8 characters' : '••••••••'} style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                    <button type="button" onClick={() => setShowPass(p => !p)} aria-label={showPass ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}>
                      <EyeIcon open={showPass} />
                    </button>
                  </div>
                </div>
                {tab === 'register' && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input type="checkbox" id="terms" required style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--accent)' }} />
                    <label htmlFor="terms" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, cursor: 'pointer' }}>
                      I agree to the <a href="#" style={{ color: 'var(--accent)' }}>Terms of Service</a> and <a href="#" style={{ color: 'var(--accent)' }}>Privacy Policy</a>
                    </label>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  style={{ marginTop: 4, padding: '13px', borderRadius: 11, background: loading ? 'var(--text-2)' : 'var(--accent)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer', transition: 'background 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  className="btn-press">
                  {loading ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      {tab === 'login' ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    tab === 'login' ? 'Sign in' : 'Create account'
                  )}
                </button>
              </form>

              {/* Switch */}
              <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-2)' }}>
                {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button onClick={() => navigate(tab === 'login' ? 'register' : 'login')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {tab === 'login' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
