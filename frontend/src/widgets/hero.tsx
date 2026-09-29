'use client';

import { useNav } from '@/hooks/useNav';
import { Icon } from '@/ui/icons';
import { FakeQR } from '@/ui/fake-qr';
import type { SiteContent } from '@/api/types';
import type { LandingDict } from '@/utils/i18n';

/** 'One event. Every moment.' → first sentence, line break, first word of the rest in accent italic. */
function HeroTitle({ text }: { text: string }) {
  const cut = text.indexOf('. ');
  if (cut < 0) return <>{text}</>;
  const [accent, ...rest] = text.slice(cut + 2).split(' ');
  return <>{text.slice(0, cut + 1)}<br /><em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>{accent}</em>{rest.length ? ' ' + rest.join(' ') : ''}</>;
}

export default function Hero({ content, t }: { content: Pick<SiteContent, 'heroTitle' | 'heroSubtitle' | 'ctaPrimary' | 'ctaSecondary'>; t: LandingDict['hero'] }) {
  const { navigate } = useNav();

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', alignItems: 'center' }}
      className="grid grid-cols-1 gap-10 px-5 pt-10 pb-16 sm:px-6 md:pt-16 lg:grid-cols-2 lg:gap-16 lg:pt-20 lg:pb-24">
      {/* Left */}
      <div className="fade-up">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} className="live-dot" />
          {t.badge}
        </div>
        <div className="h-6 md:h-8" />
        <h1 className="font-serif" style={{ fontSize: 'clamp(44px, 7vw, 80px)', lineHeight: 1.05, letterSpacing: '-0.03em', margin: '0 0 24px', color: 'var(--text)', fontWeight: 700 }}>
          <HeroTitle text={content.heroTitle} />
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2.2vw, 18px)', lineHeight: 1.65, color: 'var(--text-2)', maxWidth: 440, fontWeight: 400 }} className="mb-8 md:mb-10">
          {content.heroSubtitle}
        </p>
        <div style={{ gap: 12 }} className="flex flex-col sm:flex-row">
          <button onClick={() => navigate('register')}
            style={{ padding: '14px 28px', borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em' }}
            className="btn-press">
            {content.ctaPrimary}
          </button>
          <button onClick={() => { document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}
            style={{ padding: '14px 28px', borderRadius: 12, border: '1px solid var(--border)', background: 'none', fontSize: 16, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {content.ctaSecondary} <Icon name="arrowRight" size={16} />
          </button>
        </div>
        {/* Social proof */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} className="mt-8 md:mt-12">
          <div style={{ display: 'flex' }}>
            {[
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop',
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop',
              'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop',
              'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop',
            ].map((url, i) => (
              <img key={i} src={url} alt=""
                style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--bg)', marginLeft: i === 0 ? 0 : -10, objectFit: 'cover' }} />
            ))}
          </div>
          <div>
            <div style={{ display: 'flex', color: '#F59E0B', gap: 1 }}>
              {[...Array(5)].map((_, i) => <Icon key={i} name="star" size={14} filled />)}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '2px 0 0', fontWeight: 500 }}>
              {t.trustedBefore} <strong style={{ color: 'var(--text)' }}>{t.trustedCount}</strong> {t.trustedAfter}
            </p>
          </div>
        </div>
      </div>

      {/* Right – photo collage + QR */}
      <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', background: 'var(--border)' }} className="fade-up-1 aspect-[4/3] sm:aspect-[16/9] lg:hidden">
        <img src="https://images.unsplash.com/photo-1519741497674-611481863552?w=1000&h=620&fit=crop&auto=format"
          alt="Wedding celebration" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', top: 14, left: 14, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '5px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} className="live-dot" />
          LIVE
        </div>
        <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'var(--surface)', borderRadius: 100, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text)', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          {t.photos}
        </div>
      </div>
      <div style={{ position: 'relative', height: 520 }} className="fade-up-1 hidden lg:block">
        {/* Main photo */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '72%', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
          <img src="https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=420&fit=crop&auto=format"
            alt="Wedding celebration" style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block', background: 'var(--border)' }} />
        </div>
        {/* Secondary photo */}
        <div style={{ position: 'absolute', bottom: 40, left: 0, width: '50%', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', border: '3px solid var(--bg)' }}>
          <img src="https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=400&h=260&fit=crop&auto=format"
            alt="Event" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block', background: 'var(--border)' }} />
        </div>
        {/* Tertiary photo */}
        <div style={{ position: 'absolute', bottom: 0, right: '5%', width: '40%', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-md)', border: '3px solid var(--bg)' }}>
          <img src="https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=300&h=180&fit=crop&auto=format"
            alt="Portrait" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block', background: 'var(--border)' }} />
        </div>
        {/* Floating QR card */}
        <div style={{ position: 'absolute', top: 60, left: -24, background: 'var(--surface)', borderRadius: 16, padding: '16px 20px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', minWidth: 180 }} className="fade-up-2">
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>{t.scanShare}</p>
          <div style={{ color: '#111', background: '#fff', padding: 8, borderRadius: 8, marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
            <FakeQR size={96} />
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0, textAlign: 'center' }}>{t.join}</p>
        </div>
        {/* Live badge */}
        <div style={{ position: 'absolute', top: 16, right: '10%', background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '5px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} className="live-dot" />
          LIVE
        </div>
        {/* Photo count badge */}
        <div style={{ position: 'absolute', bottom: 190, right: '6%', background: 'var(--surface)', borderRadius: 100, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          {t.photos}
        </div>
      </div>
    </section>
  );
}
