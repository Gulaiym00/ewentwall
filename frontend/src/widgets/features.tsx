'use client';

import { Icon } from '@/ui/icons';
import type { LandingDict } from '@/utils/i18n';

// Same order as t.items.
const ICONS = ['grid', 'uploadCloud', 'heart', 'sparkle', 'book', 'monitor'] as const;

export default function Features({ t }: { t: LandingDict['features'] }) {
  return (
    <section id="features" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', scrollMarginTop: 60 }} className="px-5 py-16 sm:px-6 md:py-24">
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }} className="mb-10 md:mb-16">
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>{t.eyebrow}</p>
          <h2 className="font-serif" style={{ fontSize: 'clamp(36px, 4vw, 52px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 16px', fontWeight: 600 }}>
            {t.title}
          </h2>
        </div>
        <div style={{ gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {t.items.map((f, i) => (
            <div key={i} style={{ background: 'var(--surface)', transition: 'background 200ms' }} className="p-6 md:p-10"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-soft)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 20 }}>
                <Icon name={ICONS[i]} size={20} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
