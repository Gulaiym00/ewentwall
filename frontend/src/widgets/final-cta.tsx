'use client';

import { useNav } from '@/hooks/useNav';
import { Icon } from '@/ui/icons';
import type { LandingDict } from '@/utils/i18n';

export default function FinalCta({ t }: { t: LandingDict['finalCta'] }) {
  const { navigate } = useNav();

  return (
    <section style={{ borderTop: '1px solid var(--border)', textAlign: 'center', background: 'var(--surface)' }} className="px-5 py-16 sm:px-6 md:py-24">
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>{t.eyebrow}</p>
      <h2 className="font-serif" style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 1.05, letterSpacing: '-0.035em', margin: '0 auto 24px', fontWeight: 700, maxWidth: 700 }}>
        {t.titleTop}<br />{t.titleBottom}
      </h2>
      <p style={{ fontSize: 'clamp(16px, 2.2vw, 18px)', color: 'var(--text-2)', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }} className="mb-8 md:mb-12">
        {t.subtitle}
      </p>
      <div style={{ gap: 12, justifyContent: 'center' }} className="mx-auto flex max-w-sm flex-col sm:max-w-none sm:flex-row">
        <button onClick={() => navigate('register')}
          style={{ padding: '16px 36px', borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em' }}
          className="btn-press">
          {t.primary}
        </button>
        <button onClick={() => navigate('guest-event')}
          style={{ padding: '16px 36px', borderRadius: 12, border: '1px solid var(--border)', background: 'none', fontSize: 17, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {t.secondary} <Icon name="arrowRight" size={16} />
        </button>
      </div>
      {/* Checklist */}
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }} className="mt-8 gap-x-6 gap-y-3 md:mt-10 md:gap-x-7">
        {t.checklist.map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
            <span style={{ color: 'var(--accent)' }}><Icon name="check" size={16} strokeWidth={2.5} /></span>
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
