import type { FeaturedReview, Language } from '@/api/types';
import { Icon } from '@/ui/icons';
import { intlLocale, type LandingDict } from '@/utils/i18n';

const monthYear = (iso: string, locale: Language) => new Date(iso).toLocaleDateString(intlLocale(locale), { month: 'long', year: 'numeric' });

export default function Testimonials({ reviews, t, locale }: { reviews: FeaturedReview[]; t: LandingDict['testimonials']; locale: Language }) {
  // No invented testimonials: the section only appears once there are real, approved reviews.
  if (!reviews.length) return null;
  return (
    <section id="reviews" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', scrollMarginTop: 60 }} className="px-5 py-16 sm:px-6 md:py-24">
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }} className="mb-10 md:mb-16">
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>{t.eyebrow}</p>
          <h2 className="font-serif" style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: 0, fontWeight: 600 }}>
            {t.title}
          </h2>
        </div>
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 md:gap-5 lg:max-w-none lg:grid-cols-3">
          {reviews.map(r => (
            <div key={r.id} style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg)' }} className="p-6 md:p-8">
              <div style={{ display: 'flex', gap: 2, marginBottom: 20, color: '#F59E0B' }}>
                {[...Array(r.rating)].map((_, j) => <Icon key={j} name="star" size={14} filled />)}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)', margin: '0 0 24px', fontStyle: 'italic' }}>"{r.text}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {r.avatarUrl
                  ? <img src={r.avatarUrl} alt={r.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: 'var(--border)' }} />
                  : <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{r.name[0]}</span>}
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{r.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '2px 0 0' }}>{[r.event, monthYear(r.createdAt, locale)].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
