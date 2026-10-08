'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError, errorMessage } from '@/api/client';
import { guestApi } from '@/api/guest';
import type { PublicEvent } from '@/api/types';
import CameraCapture, { canUseInAppCamera } from '@/components/CameraCapture';
import { useApi } from '@/hooks/useApi';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useNav } from '@/hooks/useNav';
import GuestFooter from '@/layout/guest-footer';
import { PageLoader } from '@/ui/loader';
import { formatLongDate, formatNumber } from '@/utils/format';
import { LOCALE_COOKIE } from '@/utils/i18n';
import { LanguageToggle, useLocale, useT } from '@/utils/locale';

// ─── Icons ────────────────────────────────────────────────────────────────────
const CameraIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const ImageIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);
const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const MapPinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

const MAX_FILES = 10;
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&h=700&fit=crop&auto=format';

type UploadStep = 'idle' | 'camera' | 'preview' | 'uploading' | 'success';
interface Picked { file: File; url: string }

const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 17, outline: 'none', fontFamily: 'inherit',
};

const glassButton: React.CSSProperties = {
  height: 36, minWidth: 36, padding: '0 10px', borderRadius: 100, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 700,
};

/** Status pill, language and theme toggles over the cover image. */
function TopBar({ ev }: { ev: PublicEvent }) {
  const t = useT();
  const { dark, toggleDark } = useNav();
  const closed = ev.status === 'closed';
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.45)', borderRadius: 100, padding: '5px 12px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
        {ev.status === 'active' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FB7185' }} className="live-dot" />}
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
          {ev.status === 'active' ? 'LIVE' : closed ? t('CLOSED', 'ЗАВЕРШЕНО') : t('COMING SOON', 'СКОРО')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <LanguageToggle style={glassButton} />
        <button onClick={toggleDark} aria-label={dark ? t('Switch to light mode', 'Светлая тема') : t('Switch to dark mode', 'Тёмная тема')} style={{ ...glassButton, padding: 0 }}>
          {dark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </div>
    </div>
  );
}

function EventMeta({ ev }: { ev: PublicEvent }) {
  const t = useT();
  const meta: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
      {ev.startsAt && <span style={meta}><CalendarIcon /> {formatLongDate(ev.startsAt)}</span>}
      {ev.location && <span style={meta}><MapPinIcon /> {ev.location}</span>}
      <span style={meta}>
        <CameraIcon size={14} /> <span style={{ color: '#fff', fontWeight: 700 }}>{t.count(ev.stats.photos, ['photo', 'photos'], ['фото', 'фото', 'фото'])}</span>
      </span>
    </div>
  );
}

// ─── Step 1: name (and PIN) ───────────────────────────────────────────────────

function JoinScreen({ ev, onJoin }: { ev: PublicEvent; onJoin: (name: string, pin: string) => Promise<string | null> }) {
  const t = useT();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const nameRequired = ev.settings.askGuestName;
  const pinRequired = ev.settings.pinRequired;

  const submit = async (skipName = false) => {
    if (!skipName && nameRequired && !name.trim()) { setError(t('Please enter your name.', 'Пожалуйста, введите имя.')); return; }
    setError('');
    setJoining(true);
    const err = await onJoin(skipName ? '' : name, pin);
    setJoining(false);
    if (err) setError(err);
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 'clamp(240px, 38vh, 380px)', flexShrink: 0 }}>
        <img src={ev.coverUrl ?? FALLBACK_COVER} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'var(--border)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }} />
        <TopBar ev={ev} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxWidth: 640, margin: '0 auto', padding: '0 20px 40px' }}>
          <h1 className="font-serif" style={{ fontSize: 'clamp(28px, 7vw, 36px)', fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            {ev.name}
          </h1>
          <EventMeta ev={ev} />
        </div>
      </div>

      <div style={{ flex: 1, width: '100%', maxWidth: 640, margin: '-20px auto 0', padding: '0 16px calc(24px + env(safe-area-inset-bottom))', position: 'relative' }}>
        <form onSubmit={e => { e.preventDefault(); submit(); }} className="fade-up"
          style={{ padding: '28px 22px 24px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 8px' }}>
            {t('Step 1 of 2', 'Шаг 1 из 2')}
          </p>
          <h2 className="font-serif" style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {t('What’s your name?', 'Как вас зовут?')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
            {nameRequired
              ? t('Your name will be shown next to your photos.', 'Ваше имя будет показано рядом с вашими фото.')
              : t('So everyone knows who took the photo. You can skip this.', 'Чтобы все знали, кто сделал фото. Можно пропустить.')}
          </p>

          <label htmlFor="guest-name" className="sr-only">{t('Your name', 'Ваше имя')}</label>
          <input id="guest-name" value={name} onChange={e => setName(e.target.value)} autoFocus
            placeholder={t('Your name', 'Ваше имя')} autoComplete="given-name" maxLength={40} enterKeyHint="go" style={inputStyle} />

          {pinRequired && (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="guest-pin" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                {t('Event PIN', 'PIN события')}
              </label>
              <input id="guest-pin" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('PIN from the organizer', 'PIN от организатора')} inputMode="numeric" autoComplete="off" required minLength={4}
                style={{ ...inputStyle, letterSpacing: pin ? '0.25em' : undefined, fontWeight: 700 }} />
            </div>
          )}

          {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--danger)', fontWeight: 500 }}>{error}</p>}

          <button type="submit" disabled={joining} className="btn-press"
            style={{ marginTop: 20, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '15px 16px', borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: joining ? 0.6 : 1 }}>
            {joining ? t('Joining…', 'Входим…') : <>{t('Continue', 'Продолжить')} <ArrowRightIcon /></>}
          </button>
          {!nameRequired && (
            <button type="button" onClick={() => submit(true)} disabled={joining}
              style={{ marginTop: 10, width: '100%', padding: '10px', background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {t('Skip', 'Пропустить')}
            </button>
          )}
        </form>
      </div>
      <GuestFooter />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GuestEvent({ slug }: { slug: string }) {
  const t = useT();
  const { setLocale } = useLocale();
  const event = useApi(() => guestApi.event(slug), [slug]);
  const [session, setSession] = useGuestSession(slug);
  const ev = event.data;
  const canSeePhotos = !!ev && (!ev.settings.pinRequired || !!session);
  const latest = useApi(
    () => (canSeePhotos ? guestApi.photos(slug, { limit: 6 }).then(p => p.items) : Promise.resolve([])),
    [slug, canSeePhotos, session?.token],
  );

  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  // First visit from a QR code: show the page in the language the organizer chose,
  // unless the guest already picked one.
  const evLanguage = ev?.language;
  useEffect(() => {
    if (!evLanguage || document.cookie.split('; ').some(c => c.startsWith(`${LOCALE_COOKIE}=`))) return;
    if (evLanguage !== t.locale) setLocale(evLanguage);
  }, [evLanguage, t.locale, setLocale]);

  /** Returns an error message, or null once the guest has joined. */
  const join = async (name: string, pin: string) => {
    try {
      const res = await guestApi.join(slug, { name: name.trim() || undefined, pin: ev?.settings.pinRequired ? pin : undefined });
      setSession({ token: res.guestToken, name: res.guest.name });
      window.scrollTo(0, 0);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  };

  const addFiles = (list: FileList | File[] | null) => {
    if (!list?.length) return;
    const images = [...list].filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    setPicked(prev => [...prev, ...images.map(file => ({ file, url: URL.createObjectURL(file) }))].slice(0, MAX_FILES));
    setUploadError('');
    setUploadStep('preview');
  };

  /** Phones open their own camera app through the file input; computers get the in-page camera. */
  const takePhoto = () => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (!touch && canUseInAppCamera()) setUploadStep('camera');
    else cameraInput.current?.click();
  };
  const pickFromGallery = () => galleryInput.current?.click();

  const removePicked = (i: number) => {
    URL.revokeObjectURL(picked[i].url);
    const next = picked.filter((_, j) => j !== i);
    setPicked(next);
    if (!next.length) setUploadStep('idle');
  };

  const resetUpload = () => {
    picked.forEach(p => URL.revokeObjectURL(p.url));
    setPicked([]);
    setUploadStep('idle');
    setCaption('');
    setProgress(0);
    setUploadError('');
  };

  const handleUpload = async () => {
    setUploadStep('uploading');
    setProgress(0);
    try {
      const res = await guestApi.upload(slug, picked.map(p => p.file), caption, setProgress);
      setAwaitingApproval(res.awaitingApproval);
      setUploadStep('success');
      latest.reload();
      event.reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setSession(null); // token expired or event reset: join again
      setUploadError(errorMessage(err));
      setUploadStep('preview');
    }
  };

  // Lock page scroll and close with Escape while a sheet is open (the camera handles its own keys)
  useEffect(() => {
    if (uploadStep === 'idle') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && uploadStep !== 'uploading' && uploadStep !== 'camera') resetUpload();
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    // resetUpload only reads state that is current when Escape is pressed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadStep]);

  if (event.loading && !ev) return <PageLoader fullScreen label={t('Opening the event…', 'Открываем событие…')} />;
  if (!ev) {
    const notFound = event.error instanceof ApiError && event.error.status === 404;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-serif text-3xl font-bold">{notFound ? t('Event not found', 'Событие не найдено') : t('Something went wrong', 'Что-то пошло не так')}</p>
        <p className="max-w-sm text-muted">{notFound ? t('Check the QR code or the link you received from the organizer.', 'Проверьте QR-код или ссылку от организатора.') : event.error?.message}</p>
        {!notFound && <button onClick={event.reload} className="mt-2 h-10 rounded-[10px] border border-line px-4 font-semibold">{t('Try again', 'Повторить')}</button>}
      </div>
    );
  }

  const closed = ev.status === 'closed';

  // Step 1: guests coming from the QR code introduce themselves first.
  // A closed event can still be browsed without joining (unless it's PIN-protected).
  if (!session && (!closed || ev.settings.pinRequired)) return <JoinScreen ev={ev} onJoin={join} />;

  const firstName = session?.name?.split(' ')[0];
  const plural = picked.length === 1 ? t('1 photo', '1 фото') : t.count(picked.length, ['photo', 'photos'], ['фото', 'фото', 'фото']);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hidden pickers: the phone's camera app, and multi-select from the gallery */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={galleryInput} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

      {/* ── Event header ─────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 'clamp(240px, 36vw, 360px)' }}>
        <img src={ev.coverUrl ?? FALLBACK_COVER} alt={ev.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'var(--border)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
        <TopBar ev={ev} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxWidth: 640, margin: '0 auto', padding: '0 20px 24px' }}>
          <h1 className="font-serif" style={{ fontSize: 'clamp(28px, 7vw, 36px)', fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            {ev.name}
          </h1>
          <EventMeta ev={ev} />
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────── */}
      <div style={{ flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', padding: '0 20px calc(40px + env(safe-area-inset-bottom))' }}>

        {/* Welcome */}
        <div style={{ marginTop: 20, padding: '18px 20px', background: 'var(--accent-soft)', borderRadius: 14, border: '1px solid rgba(225,29,72,0.12)' }} className="fade-up">
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
            ✨ <strong>{firstName ? t(`Hi, ${firstName}!`, `Привет, ${firstName}!`) : t('Welcome!', 'Добро пожаловать!')}</strong>{' '}
            {closed
              ? t('This event is closed — you can still browse the wall.', 'Событие завершено — стену по-прежнему можно смотреть.')
              : ev.welcomeMessage ?? t('Take a photo or pick one from your gallery — it appears on the live wall right away.', 'Сделайте фото или выберите из галереи — оно сразу появится на живой стене.')}
          </p>
        </div>

        {/* Two main actions */}
        {!closed ? (
          <div className="fade-up-1" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={takePhoto} className="btn-press"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '22px 12px', borderRadius: 18, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 28px rgba(225,29,72,0.35)', minHeight: 132 }}>
              <span style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CameraIcon size={26} /></span>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{t('Take a photo', 'Сделать фото')}</span>
            </button>
            <button onClick={pickFromGallery} className="btn-press"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '22px 12px', borderRadius: 18, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', minHeight: 132 }}>
              <span style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={26} /></span>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{t('From gallery', 'Из галереи')}</span>
            </button>
          </div>
        ) : (
          <p style={{ marginTop: 16, padding: '16px', textAlign: 'center', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 14, fontWeight: 600 }}>
            {t('Uploads are closed', 'Загрузка фото закрыта')}
          </p>
        )}
        {!closed && (
          <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, color: 'var(--text-2)' }}>
            {t(`Up to ${MAX_FILES} photos at a time`, `До ${MAX_FILES} фото за раз`)}
          </p>
        )}

        {/* Latest photos */}
        {canSeePhotos && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{t('Latest photos', 'Последние фото')}</p>
              <Link href={`/e/${slug}/wall`} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{t('View all →', 'Смотреть все →')}</Link>
            </div>
            {latest.data?.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {latest.data.map(photo => (
                  <Link key={photo.id} href={`/e/${slug}/wall?photo=${photo.id}`} aria-label={t(`Photo by ${photo.author}`, `Фото от ${photo.author}`)}
                    style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: 'var(--border)', display: 'block' }}
                    className="photo-hover">
                    <img src={photo.thumbUrl} alt={photo.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </Link>
                ))}
              </div>
            ) : (
              <p style={{ padding: '28px 16px', textAlign: 'center', fontSize: 14, color: 'var(--text-2)', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                {latest.loading ? t('Loading photos…', 'Загружаем фото…') : t('No photos yet — be the first to share one!', 'Фото пока нет — станьте первым!')}
              </p>
            )}
          </div>
        )}

        {/* Stats row */}
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: t('Photos', 'Фото'), value: ev.stats.photos },
            { label: t('Guests', 'Гости'), value: ev.stats.guests },
            { label: t('Reactions', 'Реакции'), value: ev.stats.reactions },
          ].map(stat => (
            <div key={stat.label} style={{ padding: '16px 8px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center', minWidth: 0 }}>
              <p style={{ fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 700, margin: '0 0 2px', letterSpacing: '-0.02em' }}>{formatNumber(stat.value)}</p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, fontWeight: 500 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <GuestFooter />

      {/* ── In-page camera (computers) ────────────────────────── */}
      {uploadStep === 'camera' && (
        <CameraCapture
          onCapture={file => addFiles([file])}
          onClose={() => setUploadStep(picked.length ? 'preview' : 'idle')}
          onPickGallery={pickFromGallery} />
      )}

      {/* ── Bottom sheet – Preview ────────────────────────────── */}
      {uploadStep === 'preview' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={resetUpload} />
          <div role="dialog" aria-modal="true" aria-label={t('Selected photos', 'Выбранные фото')} style={{ paddingLeft: 20, paddingRight: 20 }} className="sheet slide-up">
            <div className="sheet-handle" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 20px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                {t(`${picked.length} photo${picked.length === 1 ? '' : 's'} selected`, `Выбрано: ${plural}`)}
              </h3>
              <button onClick={resetUpload} aria-label={t('Close', 'Закрыть')} style={{ width: 36, height: 36, marginRight: -8, alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}>
                <XIcon />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 20 }}>
              {picked.map((p, i) => (
                <div key={p.url} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1', background: 'var(--border)' }}>
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button onClick={() => removePicked(i)} aria-label={t('Remove photo', 'Убрать фото')}
                    style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <XIcon />
                  </button>
                </div>
              ))}
              {picked.length < MAX_FILES && (
                <>
                  <button onClick={takePhoto} aria-label={t('Take another photo', 'Сделать ещё фото')}
                    style={{ borderRadius: 12, border: '1.5px dashed var(--border)', background: 'none', cursor: 'pointer', aspectRatio: '1', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 11, fontWeight: 600 }}>
                    <CameraIcon size={20} />{t('Camera', 'Камера')}
                  </button>
                  <button onClick={pickFromGallery} aria-label={t('Add more photos', 'Добавить ещё фото')}
                    style={{ borderRadius: 12, border: '1.5px dashed var(--border)', background: 'none', cursor: 'pointer', aspectRatio: '1', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 11, fontWeight: 600 }}>
                    <PlusIcon />{t('Gallery', 'Галерея')}
                  </button>
                </>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="upload-caption" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Caption (optional)', 'Подпись (необязательно)')}</label>
              <textarea id="upload-caption" value={caption} onChange={e => setCaption(e.target.value)} maxLength={300}
                placeholder={t('Add a caption to your photos...', 'Добавьте подпись к фото...')} rows={2}
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 16, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
            </div>

            {uploadError && (
              <p role="alert" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 10, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 14, fontWeight: 500 }}>
                {uploadError}
              </p>
            )}

            <button onClick={session ? handleUpload : resetUpload} disabled={!picked.length}
              style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}
              className="btn-press">
              {session ? t('Share photos', 'Отправить на стену') : t('Join the event first', 'Сначала войдите на событие')}
            </button>
          </div>
        </div>
      )}

      {/* ── Upload progress ───────────────────────────────────── */}
      {uploadStep === 'uploading' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div role="dialog" aria-modal="true" aria-live="polite" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12 }} className="sheet slide-up">
            <div className="sheet-handle" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 28px' }} />
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{progress < 100 ? t('Uploading your photos…', 'Загружаем фото…') : t('Processing…', 'Обрабатываем…')}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>{plural}</p>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 100, height: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 100, width: `${progress}%`, transition: 'width 150ms ease' }} />
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-2)', marginTop: 12, fontWeight: 600 }}>{progress}%</p>
          </div>
        </div>
      )}

      {/* ── Success ───────────────────────────────────────────── */}
      {uploadStep === 'success' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div role="dialog" aria-modal="true" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, textAlign: 'center' }} className="sheet slide-up">
            <div className="sheet-handle" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 28px' }} />
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#fff' }} className="scale-in">
              <CheckIcon />
            </div>
            <h3 className="font-serif" style={{ fontSize: 24, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              {awaitingApproval
                ? t('Sent for approval', 'Отправлено на проверку')
                : picked.length > 1 ? t('Your photos are live! 🎉', 'Ваши фото на стене! 🎉') : t('Your photo is live! 🎉', 'Ваше фото на стене! 🎉')}
            </h3>
            <p style={{ fontSize: 15, color: 'var(--text-2)', margin: '0 0 32px', lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
              {awaitingApproval
                ? t('The organizer reviews photos before they appear on the wall. It usually doesn’t take long.', 'Организатор проверяет фото перед публикацией. Обычно это недолго.')
                : t('Everyone at the event can see them on the live wall.', 'Все гости видят их на живой стене.')}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={resetUpload}
                style={{ flex: 1, padding: '13px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'none', fontSize: 15, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                {t('Upload more', 'Ещё фото')}
              </button>
              <Link href={`/e/${slug}/wall`} onClick={resetUpload}
                style={{ flex: 2, padding: '13px', borderRadius: 11, background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
                {t('View live wall →', 'Открыть живую стену →')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
