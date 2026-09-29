'use client';

import { useNav } from '@/hooks/useNav';
import { Icon } from '@/ui/icons';
import type { LandingDict } from '@/utils/i18n';

const GALLERY_PHOTOS = [
  { id: 1, url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=500&fit=crop&auto=format', h: 'tall', reactions: 47 },
  { id: 2, url: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=400&h=280&fit=crop&auto=format', h: 'short', reactions: 31 },
  { id: 3, url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=380&fit=crop&auto=format', h: 'medium', reactions: 62 },
  { id: 4, url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop&auto=format', h: 'short', reactions: 18 },
  { id: 5, url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=400&h=460&fit=crop&auto=format', h: 'tall', reactions: 54 },
  { id: 6, url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=340&fit=crop&auto=format', h: 'medium', reactions: 89 },
  { id: 7, url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=280&fit=crop&auto=format', h: 'short', reactions: 23 },
  { id: 8, url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=420&fit=crop&auto=format', h: 'tall', reactions: 41 },
  { id: 9, url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=300&fit=crop&auto=format', h: 'short', reactions: 35 },
  { id: 10, url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=360&fit=crop&auto=format', h: 'medium', reactions: 28 },
  { id: 11, url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&auto=format', h: 'medium', reactions: 76 },
  { id: 12, url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=400&h=300&fit=crop&auto=format', h: 'short', reactions: 44 },
];

export default function LiveWallPreview({ t }: { t: LandingDict['wallPreview'] }) {
  const { navigate } = useNav();

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto' }} className="px-5 py-16 sm:px-6 md:py-24">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20 }} className="mb-8 md:mb-10">
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{t.eyebrow}</p>
          <h2 className="font-serif" style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: 0, fontWeight: 600 }}>
            {t.title}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 100, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} className="live-dot" />
          {t.live}
        </div>
      </div>
      {/* Mini masonry */}
      <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', padding: 8, background: 'var(--surface)' }}>
        <div className="masonry">
          {GALLERY_PHOTOS.map(photo => (
            <div key={photo.id} className="masonry-item photo-hover" style={{ borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--border)' }}>
              <img src={photo.url} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover' }} loading="lazy" />
              <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 100, padding: '3px 8px', backdropFilter: 'blur(4px)' }}>
                <span style={{ fontSize: 12 }}>❤️</span>
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{photo.reactions}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Bottom bar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <button onClick={() => navigate('photo-wall')}
            style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            className="btn-press">
            {t.view} <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
