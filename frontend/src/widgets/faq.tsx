'use client';

import { useState } from 'react';
import { Icon } from '@/ui/icons';
import type { LandingDict } from '@/utils/i18n';
export default function Faq({ items, t }: { items: { q: string; a: string }[]; t: LandingDict['faq'] }) {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <section id="faq" style={{ maxWidth: 720, margin: '0 auto', scrollMarginTop: 60 }} className="px-5 py-16 sm:px-6 md:py-24">
      <div style={{ textAlign: 'center' }} className="mb-10 md:mb-14">
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>{t.eyebrow}</p>
        <h2 className="font-serif" style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: 0, fontWeight: 600 }}>
          {t.title}
        </h2>
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {items.map((faq, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setFaqOpen(faqOpen === i ? null : i)} aria-expanded={faqOpen === i}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{faq.q}</span>
              <span style={{ color: 'var(--text-2)', flexShrink: 0, transition: 'transform 250ms', transform: faqOpen === i ? 'rotate(180deg)' : 'none' }}>
                <Icon name="chevronDown" size={16} />
              </span>
            </button>
            {faqOpen === i && (
              <div style={{ paddingBottom: 20 }} className="fade-in">
                <p style={{ margin: 0, fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
