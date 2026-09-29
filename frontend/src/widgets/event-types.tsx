import type { LandingDict } from '@/utils/i18n';

// Same order as t.items.
const EVENT_TYPES = [
  { label: 'Weddings',    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=400&fit=crop&auto=format' },
  { label: 'Birthdays',   url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&auto=format' },
  { label: 'Concerts',    url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=400&fit=crop&auto=format' },
  { label: 'Corporate',   url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&h=400&fit=crop&auto=format' },
  { label: 'Private',     url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=400&fit=crop&auto=format' },
];

export default function EventTypes({ t }: { t: LandingDict['eventTypes'] }) {
  return (
    <section id="examples" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', scrollMarginTop: 60 }} className="px-5 py-12 sm:px-6 md:py-16">
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }} className="mb-6 md:mb-8">
          {t.title}
        </p>
        <div className="no-scroll -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
          {EVENT_TYPES.map((et, i) => (
            <div key={et.url} style={{ borderRadius: 14, overflow: 'hidden', position: 'relative', cursor: 'pointer', aspectRatio: '3/4' }} className="photo-hover w-[42%] shrink-0 snap-start sm:w-auto">
              <img src={et.url} alt={t.items[i]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'var(--border)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
              <p style={{ position: 'absolute', bottom: 14, left: 14, right: 14, color: '#fff', fontSize: 14, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>{t.items[i]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
