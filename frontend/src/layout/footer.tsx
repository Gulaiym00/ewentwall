'use client';

import type { LandingDict } from '@/utils/i18n';

export default function Footer({ t }: { t: LandingDict['footer'] }) {
  return (
    <footer style={{ borderTop: '1px solid var(--border)' }} className="px-5 py-8 sm:px-6 md:py-10">
      <div style={{ maxWidth: 1280, margin: '0 auto', gap: 20 }} className="flex flex-col items-center text-center md:flex-row md:justify-between md:text-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4" fill="white"/></svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>EventWall</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
          © 2026 EventWall. {t.rights}
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          {t.links.map(item => (
            <a key={item} href="#" style={{ fontSize: 13, color: 'var(--text-2)', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
              {item}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
