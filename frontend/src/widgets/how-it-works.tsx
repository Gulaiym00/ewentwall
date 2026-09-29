import type { LandingDict } from '@/utils/i18n';

const STEPS = [
  { num: '01', img: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&h=360&fit=crop&auto=format' },
  { num: '02', img: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=600&h=360&fit=crop&auto=format' },
  { num: '03', img: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=360&fit=crop&auto=format' },
];

export default function HowItWorks({ t }: { t: LandingDict['howItWorks'] }) {
  return (
    <section id="how-it-works" style={{ maxWidth: 1280, margin: '0 auto', scrollMarginTop: 60 }} className="px-5 py-16 sm:px-6 md:py-24">
      <div style={{ maxWidth: 560 }} className="mb-10 md:mb-16">
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>{t.eyebrow}</p>
        <h2 className="font-serif" style={{ fontSize: 'clamp(36px, 4vw, 52px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 16px', fontWeight: 600 }}>
          {t.title}
        </h2>
        <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.65 }}>
          {t.subtitle}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
        {STEPS.map((s, i) => ({ ...s, ...t.steps[i] })).map((step, i) => (
          <div key={i}>
            <div style={{ borderRadius: 16, overflow: 'hidden', aspectRatio: '16/10', background: 'var(--border)' }} className="mb-5 md:mb-7">
              <img src={step.img} alt={step.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
              <span className="font-serif text-4xl md:text-5xl" style={{ fontWeight: 700, color: 'var(--border)', lineHeight: 1 }}>{step.num}</span>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>{step.title}</h3>
            </div>
            <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
