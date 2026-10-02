'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorMessage } from '@/api/client';
import { eventsApi } from '@/api/events';
import type { OrganizerEvent, Role } from '@/api/types';
import { copyText, QrPoster, useEventQr, useQrPoster } from '@/components/EventQr';
import { useToast } from '@/components/Toast';
import { useRequireAuth } from '@/hooks/useAuth';
import { useNav } from '@/hooks/useNav';
import { PageLoader, Spinner } from '@/ui/loader';
import { useT } from '@/utils/locale';
import { eventTypeLabel } from '@/utils/labels';

const ALLOWED: Role[] = ['organizer', 'admin'];
const COVER_MAX_MB = 10;

// ─── Icons ────────────────────────────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface EventData {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  location: string;
  message: string;
  lang: string;
  premoderation: boolean;
  comments: boolean;
  reactions: boolean;
  guestName: boolean;
  pin: boolean;
  pinCode: string;
  downloads: boolean;
}

const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate', 'Concert', 'Private Party', 'Anniversary', 'Other'];

const STEPS = [
  { id: 1, label: 'Event details', ru: 'Детали' },
  { id: 2, label: 'Appearance', ru: 'Оформление' },
  { id: 3, label: 'Guest settings', ru: 'Гости' },
  { id: 4, label: 'QR & sharing', ru: 'QR и ссылка' },
];

const ToggleSwitch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{
    width: 44, height: 24, borderRadius: 12,
    background: on ? 'var(--accent)' : 'var(--border)',
    border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms', flexShrink: 0,
  }}>
    <span style={{
      position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff',
      transition: 'left 200ms', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    }} />
  </button>
);

const SettingRow = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-2)' }}>{desc}</p>
    </div>
    <ToggleSwitch on={value} onChange={onChange} label={label} />
  </div>
);

export default function CreateEvent() {
  const t = useT();
  const { navigate } = useNav();
  const router = useRouter();
  const toast = useToast();
  const user = useRequireAuth(ALLOWED);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<OrganizerEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [cover, setCover] = useState<{ file: File; preview: string } | null>(null);

  const [data, setData] = useState<EventData>({
    name: '',
    type: 'Wedding',
    startDate: '',
    endDate: '',
    location: '',
    message: '',
    lang: t.locale === 'ru' ? 'RU' : 'EN',
    premoderation: false,
    comments: true,
    reactions: true,
    guestName: false,
    pin: false,
    pinCode: '',
    downloads: true,
  });

  const update = (key: keyof EventData, value: EventData[keyof EventData]) => {
    setData(d => ({ ...d, [key]: value }));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 11,
    border: '1.5px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 16,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 150ms',
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Real QR code of the created event, drawn from its guest link.
  const qrUrl = useEventQr(created?.joinUrl);
  const poster = useQrPoster(created, qrUrl);

  // Free the cover preview when it changes or the page closes.
  useEffect(() => () => { if (cover) URL.revokeObjectURL(cover.preview); }, [cover]);

  const pickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast(t('Choose a JPEG, PNG, WebP or GIF image', 'Выберите изображение JPEG, PNG, WebP или GIF'), 'danger'); return; }
    if (file.size > COVER_MAX_MB * 1024 * 1024) { toast(t(`Cover must be under ${COVER_MAX_MB} MB`, `Обложка должна быть меньше ${COVER_MAX_MB} МБ`), 'danger'); return; }
    setCover({ file, preview: URL.createObjectURL(file) });
  };

  const createEvent = async () => {
    if (data.pin && !/^\d{4,6}$/.test(data.pinCode)) { setCreateError(t('PIN must be 4–6 digits.', 'PIN должен состоять из 4–6 цифр.')); return; }
    setCreateError('');
    setCreating(true);
    try {
      let event = await eventsApi.create({
        name: data.name.trim(),
        type: data.type,
        startsAt: data.startDate || undefined,
        endsAt: data.endDate || undefined,
        location: data.location.trim() || undefined,
        welcomeMessage: data.message.trim() || undefined,
        language: data.lang === 'RU' ? 'ru' : 'en',
        premoderation: data.premoderation,
        allowComments: data.comments,
        allowReactions: data.reactions,
        askGuestName: data.guestName,
        allowDownloads: data.downloads,
        pin: data.pin ? data.pinCode : undefined,
      });
      if (cover) {
        try {
          event = await eventsApi.uploadCover(event.id, cover.file);
        } catch (err) {
          toast(t(`Event created, but the cover failed to upload: ${errorMessage(err)}`, `Событие создано, но обложку загрузить не удалось: ${errorMessage(err)}`), 'danger');
        }
      }
      setCreated(event);
      setStep(4);
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    if (await copyText(created.joinUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast(t('Copy failed — tap the link above to select it', 'Не удалось скопировать — нажмите на ссылку выше, чтобы выделить её'), 'danger');
    }
  };

  const canNext = () => {
    if (step === 1) return data.name.trim().length > 0;
    if (step === 3) return !creating;
    return true;
  };

  const next = () => {
    if (!canNext()) return;
    if (step === 3) createEvent();
    else setStep(s => s + 1);
  };

  if (!user) return <PageLoader fullScreen label={t('Checking your session…', 'Проверяем сессию…')} />;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-4 sm:px-6" style={{ borderBottom: '1px solid var(--border)', height: 56, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 20 }}>
        <button onClick={() => navigate('dashboard')} aria-label={t('Back to dashboard', 'Назад в кабинет')}
          style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
          <ArrowLeftIcon />
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>{t('Create event', 'Новое событие')}</h1>
      </div>

      {/* Stepper */}
      <div style={{ maxWidth: 620, margin: '0 auto' }} className="px-5 pt-6 sm:px-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }} className="mb-3 sm:mb-10" aria-label={t(`Step ${step} of ${STEPS.length}`, `Шаг ${step} из ${STEPS.length}`)}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', border: `2px solid ${step > s.id ? 'var(--accent)' : step === s.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: step > s.id ? 'var(--accent)' : step === s.id ? 'var(--accent-soft)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms', flexShrink: 0,
                }}>
                  {step > s.id ? (
                    <span style={{ color: '#fff' }}><CheckIcon /></span>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: step === s.id ? 'var(--accent)' : 'var(--text-2)' }}>{s.id}</span>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: step === s.id ? 'var(--accent)' : 'var(--text-2)', whiteSpace: 'nowrap' }} className="hidden sm:block">{t(s.label, s.ru)}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > s.id ? 'var(--accent)' : 'var(--border)', marginLeft: 8, marginRight: 8, transition: 'background 200ms' }} className="sm:mb-5" />
              )}
            </div>
          ))}
        </div>
        <p className="mb-8 sm:hidden" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {t('Step', 'Шаг')} {step} {t('of', 'из')} {STEPS.length} · <span style={{ color: 'var(--accent)' }}>{t(STEPS[step - 1].label, STEPS[step - 1].ru)}</span>
        </p>

        {/* ── Step 1: Event details ──────────────────────────── */}
        {step === 1 && (
          <div className="fade-up">
            <h2 className="font-serif" style={{ fontSize: 'clamp(22px, 5vw, 26px)', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{t('Event details', 'Детали события')}</h2>
            <p style={{ fontSize: 15, color: 'var(--text-2)', margin: '0 0 28px' }}>{t('Tell us about your event.', 'Расскажите о вашем событии.')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label htmlFor="ev-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Event name', 'Название')} <span style={{ color: 'var(--accent)' }}>*</span></label>
                <input id="ev-name" value={data.name} onChange={e => update('name', e.target.value)}
                  placeholder={t('Anna & Timur Wedding', 'Свадьба Анны и Тимура')} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Event type', 'Тип события')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EVENT_TYPES.map(ty => (
                    <button key={ty} onClick={() => update('type', ty)} aria-pressed={data.type === ty}
                      style={{ padding: '8px 16px', borderRadius: 100, border: `1.5px solid ${data.type === ty ? 'var(--accent)' : 'var(--border)'}`, background: data.type === ty ? 'var(--accent-soft)' : 'none', fontSize: 13, fontWeight: 600, color: data.type === ty ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', transition: 'all 150ms' }}>
                      {eventTypeLabel(t, ty)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3">
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="ev-start" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Start date', 'Дата начала')}</label>
                  <input id="ev-start" type="date" value={data.startDate} onChange={e => update('startDate', e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="ev-end" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('End date', 'Дата окончания')}</label>
                  <input id="ev-end" type="date" min={data.startDate || undefined} value={data.endDate} onChange={e => update('endDate', e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
              </div>

              <div>
                <label htmlFor="ev-location" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Location', 'Место')}</label>
                <input id="ev-location" value={data.location} onChange={e => update('location', e.target.value)}
                  placeholder={t('Bishkek, Kyrgyzstan', 'Бишкек, Кыргызстан')} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>

              <div>
                <label htmlFor="ev-message" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Welcome message', 'Приветствие для гостей')}</label>
                <textarea id="ev-message" value={data.message} onChange={e => update('message', e.target.value)}
                  placeholder={t("Welcome! Share your photos from today's celebration...", 'Добро пожаловать! Делитесь фото с сегодняшнего праздника...')} rows={3}
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Appearance ────────────────────────────── */}
        {step === 2 && (
          <div className="fade-up">
            <h2 className="font-serif" style={{ fontSize: 'clamp(22px, 5vw, 26px)', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{t('Appearance', 'Оформление')}</h2>
            <p style={{ fontSize: 15, color: 'var(--text-2)', margin: '0 0 28px' }}>{t('Customize how your event looks.', 'Настройте, как выглядит ваше событие.')}</p>

            {/* Cover image */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Cover photo', 'Обложка')}</label>
              <label style={{ position: 'relative', borderRadius: 14, border: '2px dashed var(--border)', overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer', transition: 'border-color 150ms', height: 'clamp(150px, 40vw, 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickCover} className="sr-only" />
                {cover ? (
                  <>
                    <img src={cover.preview} alt={t('Cover preview', 'Предпросмотр обложки')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: 10, right: 10, padding: '6px 12px', borderRadius: 100, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, fontWeight: 600 }}>{t('Change', 'Заменить')}</span>
                  </>
                ) : (
                  <>
                    <div style={{ color: 'var(--text-2)' }}><UploadIcon /></div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>{t('Upload cover photo', 'Загрузить обложку')}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)' }}>{t(`JPEG, PNG or WebP up to ${COVER_MAX_MB} MB`, `JPEG, PNG или WebP до ${COVER_MAX_MB} МБ`)}</p>
                  </>
                )}
              </label>
            </div>

            {/* Language */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('Guest page language', 'Язык страницы для гостей')}</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['EN', 'RU'].map(l => (
                  <button key={l} onClick={() => update('lang', l)}
                    style={{ padding: '10px 24px', borderRadius: 10, border: `1.5px solid ${data.lang === l ? 'var(--accent)' : 'var(--border)'}`, background: data.lang === l ? 'var(--accent-soft)' : 'none', fontSize: 14, fontWeight: 700, color: data.lang === l ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', letterSpacing: '0.05em' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview mockup */}
            <div style={{ borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)' }}>
              <div style={{ height: 120, background: cover ? `linear-gradient(to top, rgba(0,0,0,0.7), transparent), url(${cover.preview}) center/cover` : 'linear-gradient(135deg, #E11D48 0%, #9F1239 100%)', display: 'flex', alignItems: 'flex-end', padding: '0 20px 16px' }}>
                <div>
                  <p className="font-serif" style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 4px', overflowWrap: 'anywhere' }}>{data.name || t('Your Event Name', 'Название события')}</p>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: 0 }}>{data.location || t('Location', 'Место')}</p>
                </div>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ padding: '9px 24px', borderRadius: 100, background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700 }}>{t('+ Add photos', '+ Добавить фото')}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Guest settings ───────────────────────── */}
        {step === 3 && (
          <div className="fade-up">
            <h2 className="font-serif" style={{ fontSize: 'clamp(22px, 5vw, 26px)', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{t('Guest settings', 'Настройки для гостей')}</h2>
            <p style={{ fontSize: 15, color: 'var(--text-2)', margin: '0 0 28px' }}>{t('Control what guests can do.', 'Что могут делать гости.')}</p>

            <div style={{ borderTop: '1px solid var(--border)' }}>
              <SettingRow label={t('Pre-moderation', 'Премодерация')} desc={t('Photos need your approval before appearing on the wall.', 'Фото появляются на стене только после вашего одобрения.')} value={data.premoderation} onChange={v => update('premoderation', v)} />
              <SettingRow label={t('Comments', 'Комментарии')} desc={t('Allow guests to comment on photos.', 'Гости могут комментировать фото.')} value={data.comments} onChange={v => update('comments', v)} />
              <SettingRow label={t('Reactions', 'Реакции')} desc={t('Allow guests to react with emoji.', 'Гости могут ставить эмодзи-реакции.')} value={data.reactions} onChange={v => update('reactions', v)} />
              <SettingRow label={t('Require guest name', 'Имя обязательно')} desc={t('Guests must enter their name before uploading. Otherwise the name is optional.', 'Гости обязательно вводят имя перед загрузкой. Иначе имя можно пропустить.')} value={data.guestName} onChange={v => update('guestName', v)} />
              <SettingRow label={t('Allow downloads', 'Разрешить скачивание')} desc={t('Guests can download photos from the wall.', 'Гости могут скачивать фото со стены.')} value={data.downloads} onChange={v => update('downloads', v)} />

              <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: data.pin ? 14 : 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t('PIN protection', 'Защита PIN-кодом')}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-2)' }}>{t('Require a PIN to join the event.', 'Для входа на событие нужен PIN.')}</p>
                  </div>
                  <ToggleSwitch on={data.pin} onChange={v => update('pin', v)} label={t('PIN protection', 'Защита PIN-кодом')} />
                </div>
                {data.pin && (
                  <input value={data.pinCode} onChange={e => update('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('4–6 digit PIN', 'PIN из 4–6 цифр')} aria-label={t('PIN code', 'PIN-код')} inputMode="numeric" autoComplete="off" maxLength={6} style={{ ...inputStyle, width: 200, maxWidth: '100%', fontSize: 20, letterSpacing: '0.2em', fontWeight: 700 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                )}
              </div>
            </div>
            {createError && (
              <p role="alert" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 14, fontWeight: 500 }}>
                {createError}
              </p>
            )}
          </div>
        )}

        {/* ── Step 4: QR & sharing ─────────────────────────── */}
        {step === 4 && (
          <div className="fade-up" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="font-serif" style={{ fontSize: 'clamp(24px, 5.5vw, 28px)', fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              {t('Your event is ready.', 'Событие готово.')}
            </h2>
            <p style={{ fontSize: 'clamp(15px, 3.5vw, 16px)', color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }} className="mb-7 sm:mb-9">
              {t('Share the QR code with your guests. They can scan it to instantly join the photo wall.', 'Покажите QR-код гостям — отсканировав его, они сразу попадут на фотостену.')}
            </p>

            {/* QR poster: event type, name, the event's own QR and "Share the moments" */}
            {created && <QrPoster event={created} qrUrl={qrUrl} />}
            {created && <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '12px auto 28px', maxWidth: 340, overflowWrap: 'anywhere', userSelect: 'all', WebkitUserSelect: 'all' }}>{created.joinUrl}</p>}

            {/* Share buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto 24px' }}>
              <button onClick={handleCopy}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 12, background: copied ? 'var(--accent)' : 'var(--surface)', color: copied ? '#fff' : 'var(--text)', border: `1.5px solid ${copied ? 'var(--accent)' : 'var(--border)'}`, fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms' }}>
                {copied ? <><CheckIcon /> {t('Copied!', 'Скопировано!')}</> : <><CopyIcon /> {t('Copy link', 'Скопировать ссылку')}</>}
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={poster.share} disabled={!poster.ready} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'none', fontSize: 14, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', opacity: poster.ready ? 1 : 0.6 }}>
                  {poster.ready ? <ShareIcon /> : <Spinner size={16} />} {t('Share photo', 'Поделиться фото')}
                </button>
                <button onClick={poster.download} disabled={!poster.ready} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'none', fontSize: 14, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', opacity: poster.ready ? 1 : 0.6 }}>
                  <DownloadIcon /> {t('Download photo', 'Скачать фото')}
                </button>
              </div>
            </div>

            {/* Go to event */}
            <button onClick={() => created && router.push(`/e/${created.slug}`)}
              style={{ padding: '14px 36px', borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              className="btn-press inline-flex w-full max-w-[360px] sm:w-auto">
              {t('Open event page', 'Открыть страницу события')} <ArrowRightIcon />
            </button>
          </div>
        )}

        {/* ── Navigation buttons ────────────────────────────── */}
        {step < 4 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, background: 'var(--bg)', zIndex: 10 }}
            className="sticky bottom-0 -mx-5 mt-8 border-t border-[var(--border)] px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-10 sm:border-0 sm:px-0 sm:pt-0 sm:pb-12">
            <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('dashboard')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 18px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'none', fontSize: 15, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>
              <ArrowLeftIcon /> {step > 1 ? t('Back', 'Назад') : t('Cancel', 'Отмена')}
            </button>
            <button onClick={next} disabled={!canNext()} className="btn-press flex-1 sm:flex-none"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 28px', borderRadius: 11, background: canNext() ? 'var(--accent)' : 'var(--border)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: canNext() ? 'pointer' : 'default', transition: 'background 200ms' }}>
              {step === 3 ? (creating ? t('Creating…', 'Создаём…') : t('Create event', 'Создать событие')) : t('Continue', 'Далее')} {creating ? <Spinner size={16} /> : <ArrowRightIcon />}
            </button>
          </div>
        )}
        {step === 4 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, background: 'var(--bg)', zIndex: 10 }}
            className="sticky bottom-0 -mx-5 mt-8 border-t border-[var(--border)] px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-10 sm:border-0 sm:px-0 sm:pt-0 sm:pb-12">
            <button onClick={() => created && router.push(`/dashboard/events/${created.id}`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 18px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'none', fontSize: 15, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>
              <ArrowLeftIcon /> {t('Event settings', 'Настройки события')}
            </button>
            <button onClick={() => navigate('dashboard')} className="btn-press flex-1 sm:flex-none"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 15, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
              {t('Go to dashboard', 'В кабинет')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
