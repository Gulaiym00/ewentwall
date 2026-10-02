import { ImageResponse } from 'next/og';
import { QR_PATTERN } from '@/ui/fake-qr';

// Link preview shown by Telegram, WhatsApp, Instagram etc. when the site is shared.
// Without it messengers pick the first picture on the page (a reviewer's avatar).

export const alt = 'EventWall — живая фотостена для вашего праздника';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TITLE = 'Живая фотостена для вашего праздника';
const SUBTITLE = 'Гости сканируют QR-код и делятся фото — без приложений и регистрации';
const QR_CAPTION = 'Поделитесь моментами';

/** A Google font as TTF for the given text (the image renderer has no Cyrillic glyphs of its own). */
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return src ? await (await fetch(src)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [serif, sans] = await Promise.all([
    googleFont('Playfair+Display', 700, TITLE),
    googleFont('Inter', 600, `EventWall${SUBTITLE}${QR_CAPTION}`),
  ]);
  const fonts = [
    ...(serif ? [{ name: 'Playfair', data: serif, weight: 700 as const }] : []),
    ...(sans ? [{ name: 'Inter', data: sans, weight: 600 as const }] : []),
  ];
  const cell = 12;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 80px', gap: 64, background: 'linear-gradient(135deg, #E11D48 0%, #9F1239 100%)', fontFamily: 'Inter' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#E11D48"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" fill="#fff" /></svg>
            </div>
            <span style={{ fontSize: 36, fontWeight: 600 }}>EventWall</span>
          </div>
          <div style={{ marginTop: 40, fontFamily: 'Playfair', fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{TITLE}</div>
          <div style={{ marginTop: 24, fontSize: 28, lineHeight: 1.4, color: 'rgba(255,255,255,0.85)' }}>{SUBTITLE}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 28, borderRadius: 32, background: '#fff', boxShadow: '0 30px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {QR_PATTERN.map((row, r) => (
              <div key={r} style={{ display: 'flex' }}>
                {row.map((on, c) => <div key={c} style={{ width: cell, height: cell, background: on ? '#111' : '#fff' }} />)}
              </div>
            ))}
          </div>
          <span style={{ marginTop: 18, fontSize: 24, fontWeight: 600, color: '#E11D48' }}>{QR_CAPTION}</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
