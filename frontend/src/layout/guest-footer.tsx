'use client';

import Link from 'next/link';
import { useT } from '@/utils/locale';

/** About-the-site footer on the guest pages people reach from the QR code. */
export default function GuestFooter() {
  const t = useT();
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px calc(28px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
          <span style={{ width: 26, height: 26, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4" fill="white"/></svg>
          </span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>EventWall</span>
        </Link>
        <p style={{ margin: '12px auto 0', maxWidth: 420, fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
          {t('A live photo wall for weddings, birthdays and any celebration. Guests scan a QR code and share photos — no app, no sign-up.',
            'Живая фотостена для свадеб, дней рождения и любых праздников. Гости сканируют QR-код и делятся фото — без приложений и регистрации.')}
        </p>
        <Link href="/" className="btn-press"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 18px', borderRadius: 100, border: '1.5px solid var(--border)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {t('Create your own event →', 'Создать своё событие →')}
        </Link>
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, fontWeight: 500 }}>
          <Link href="/#how-it-works" style={{ color: 'var(--text-2)' }}>{t('How it works', 'Как это работает')}</Link>
          <Link href="/#features" style={{ color: 'var(--text-2)' }}>{t('Features', 'Возможности')}</Link>
          <Link href="/#faq" style={{ color: 'var(--text-2)' }}>FAQ</Link>
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-2)' }}>© 2026 EventWall. {t('All rights reserved.', 'Все права защищены.')}</p>
      </div>
    </footer>
  );
}
