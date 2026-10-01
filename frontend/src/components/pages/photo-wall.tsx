'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, errorMessage } from '@/api/client';
import { guestApi } from '@/api/guest';
import type { Comment, Photo, ReportReason } from '@/api/types';
import { useToast } from '@/components/Toast';
import { useApi } from '@/hooks/useApi';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useNav } from '@/hooks/useNav';
import { PageLoader, Spinner } from '@/ui/loader';
import { plural, timeAgo } from '@/utils/format';
import { LanguageToggle, useT } from '@/utils/locale';

// ─── Icons ────────────────────────────────────────────────────────────────────
const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const FlagIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const MessageIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const ChevronLeftIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const REACTION_EMOJIS = ['❤️', '😂', '🔥', '😍', '👏'];
const REPORT_REASONS: { value: ReportReason; label: string; ru: string }[] = [
  { value: 'inappropriate', label: 'Inappropriate content', ru: 'Неприемлемый контент' },
  { value: 'violence', label: 'Violence', ru: 'Насилие' },
  { value: 'privacy', label: 'Shows me without consent', ru: 'Я на фото без согласия' },
  { value: 'copyright', label: 'Copyright', ru: 'Авторские права' },
  { value: 'spam', label: 'Spam', ru: 'Спам' },
];
const PAGE = 40;

type SortMode = 'newest' | 'popular' | 'mine';

const initials = (name: string) => name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'G';

export default function PhotoWall({ slug }: { slug: string }) {
  const t = useT();
  const { dark, toggleDark } = useNav();
  const router = useRouter();
  const toast = useToast();
  const event = useApi(() => guestApi.event(slug), [slug]);
  const [session, setSession] = useGuestSession(slug);
  const ev = event.data;
  const canSee = !!ev && (!ev.settings.pinRequired || !!session);

  const [sort, setSort] = useState<SortMode>('newest');
  const feedKey = `${sort}|${session?.token ?? ''}|${canSee}`;
  const [feed, setFeed] = useState<{ key: string; items: Photo[]; next: string | null; error?: string }>({ key: '', items: [], next: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [incoming, setIncoming] = useState<Photo[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [newComment, setNewComment] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [heartAnim, setHeartAnim] = useState<string | null>(null);
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const items = useMemo(() => (feed.key === feedKey ? feed.items : []), [feed, feedKey]);
  // Ids on screen, read by the live-update handler without re-subscribing
  const shownIds = useRef(new Set<string>());
  useEffect(() => { shownIds.current = new Set(items.map(p => p.id)); }, [items]);
  const feedLoading = canSee && feed.key !== feedKey;

  // First page for the current sort / session
  useEffect(() => {
    if (!canSee || (sort === 'mine' && !session)) return;
    let alive = true;
    guestApi.photos(slug, { sort, limit: PAGE }).then(
      page => { if (alive) { setFeed({ key: feedKey, items: page.items, next: page.nextCursor }); setIncoming([]); } },
      err => { if (alive) setFeed({ key: feedKey, items: [], next: null, error: errorMessage(err) }); },
    );
    return () => { alive = false; };
  }, [slug, sort, feedKey, canSee, session]);

  const loadMore = useCallback(async () => {
    if (!feed.next || loadingMore || feed.key !== feedKey) return;
    setLoadingMore(true);
    try {
      const page = await guestApi.photos(slug, { sort, cursor: feed.next, limit: PAGE });
      setFeed(f => (f.key === feedKey ? { ...f, items: [...f.items, ...page.items.filter(p => !f.items.some(x => x.id === p.id))], next: page.nextCursor } : f));
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setLoadingMore(false);
    }
  }, [feed.next, feed.key, feedKey, loadingMore, slug, sort, toast]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Live updates (Server-Sent Events)
  useEffect(() => {
    if (!canSee) return;
    const es = new EventSource(guestApi.streamUrl(slug));
    es.addEventListener('photo.published', e => {
      const photo = JSON.parse((e as MessageEvent).data) as Photo;
      if (shownIds.current.has(photo.id)) {
        // Approved or restored photo we already show: refresh it in place
        setFeed(f => ({ ...f, items: f.items.map(p => (p.id === photo.id ? { ...p, ...photo, myReaction: p.myReaction } : p)) }));
      } else {
        setIncoming(list => (list.some(p => p.id === photo.id) ? list : [photo, ...list]));
      }
    });
    es.addEventListener('photo.removed', e => {
      const { id } = JSON.parse((e as MessageEvent).data) as { id: string };
      setFeed(f => ({ ...f, items: f.items.filter(p => p.id !== id) }));
      setIncoming(list => list.filter(p => p.id !== id));
      setSelectedId(current => (current === id ? null : current));
    });
    return () => es.close();
  }, [slug, canSee, session?.token]);

  const showIncoming = () => {
    setFeed(f => ({ ...f, items: [...incoming.filter(p => !f.items.some(x => x.id === p.id)), ...f.items] }));
    setIncoming([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedIdx = selectedId ? items.findIndex(p => p.id === selectedId) : -1;
  const selectedPhoto = selectedIdx >= 0 ? items[selectedIdx] : null;
  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx >= 0 && selectedIdx < items.length - 1;
  const openPhoto = (id: string | null) => { setSelectedId(id); setComments(null); setShowComments(false); setReportOpen(false); };
  const showPrev = () => { if (hasPrev) openPhoto(items[selectedIdx - 1].id); };
  const showNext = () => { if (hasNext) openPhoto(items[selectedIdx + 1].id); };
  const closeViewer = () => openPhoto(null);

  // Viewer: lock page scroll, keyboard navigation
  useEffect(() => {
    if (!selectedPhoto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') { if (showComments) setShowComments(false); else if (reportOpen) setReportOpen(false); else closeViewer(); }
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  });

  const replacePhoto = (photo: Photo) => setFeed(f => ({ ...f, items: f.items.map(p => (p.id === photo.id ? photo : p)) }));

  /** Guests must join before interacting; open events are joined silently. */
  const ensureGuest = async (): Promise<boolean> => {
    if (session) return true;
    if (!ev || ev.settings.pinRequired || ev.settings.askGuestName) {
      toast(t('Join the event first to react and comment', 'Сначала войдите на событие, чтобы ставить реакции и комментировать'), 'danger');
      router.push(`/e/${slug}`);
      return false;
    }
    try {
      const res = await guestApi.join(slug, {});
      setSession({ token: res.guestToken, name: res.guest.name });
      return true;
    } catch (err) {
      toast(errorMessage(err), 'danger');
      return false;
    }
  };

  const handleReact = async (photo: Photo, emoji: string) => {
    if (!ev?.settings.allowReactions) return;
    if (!(await ensureGuest())) return;
    try {
      replacePhoto(await guestApi.react(slug, photo.id, emoji));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setSession(null);
      toast(errorMessage(err), 'danger');
    }
  };

  const handleTap = (photo: Photo) => {
    // eslint-disable-next-line react-hooks/purity -- only called from onClick
    const now = Date.now();
    if (lastTap.current?.id === photo.id && now - lastTap.current.at < 300) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = null;
      setHeartAnim(photo.id);
      setTimeout(() => setHeartAnim(null), 800);
      if (photo.myReaction !== '❤️') handleReact(photo, '❤️'); // double tap only likes, never un-likes
      return;
    }
    lastTap.current = { id: photo.id, at: now };
    tapTimer.current = setTimeout(() => openPhoto(photo.id), 250);
  };

  const openComments = async () => {
    if (!selectedPhoto) return;
    setShowComments(true);
    try {
      setComments(await guestApi.comments(slug, selectedPhoto.id));
    } catch (err) {
      toast(errorMessage(err), 'danger');
      setComments([]);
    }
  };

  const handleSendComment = async () => {
    const text = newComment.trim();
    if (!text || !selectedPhoto) return;
    if (!(await ensureGuest())) return;
    try {
      const c = await guestApi.comment(slug, selectedPhoto.id, text);
      setComments(list => [c, ...(list ?? [])]);
      replacePhoto({ ...selectedPhoto, commentCount: selectedPhoto.commentCount + 1 });
      setNewComment('');
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };

  const handleReport = async (reason: ReportReason) => {
    if (!selectedPhoto) return;
    setReportOpen(false);
    if (!(await ensureGuest())) return;
    try {
      await guestApi.report(slug, selectedPhoto.id, reason);
      toast(t('Thanks — the photo was reported to the moderators', 'Спасибо — жалоба отправлена модераторам'));
    } catch (err) {
      toast(err instanceof ApiError && err.status === 409 ? t('You already reported this photo', 'Вы уже пожаловались на это фото') : errorMessage(err), err instanceof ApiError && err.status === 409 ? 'success' : 'danger');
    }
  };

  const handleDownload = async () => {
    if (!selectedPhoto) return;
    try {
      const blob = await (await fetch(selectedPhoto.url)).blob();
      const href = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href, download: `photo-${selectedPhoto.id.slice(0, 8)}.${blob.type.split('/')[1] ?? 'jpg'}` }).click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      window.open(selectedPhoto.url, '_blank', 'noopener');
    }
  };

  const handleDelete = async () => {
    if (!selectedPhoto || !confirm(t('Delete this photo from the wall?', 'Удалить это фото со стены?'))) return;
    try {
      await guestApi.deletePhoto(slug, selectedPhoto.id);
      setFeed(f => ({ ...f, items: f.items.filter(p => p.id !== selectedPhoto.id) }));
      closeViewer();
      toast(t('Photo deleted', 'Фото удалено'), 'danger');
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };

  if (event.loading && !ev) return <PageLoader fullScreen label={t('Opening the wall…', 'Открываем стену…')} />;
  if (!ev) {
    const notFound = event.error instanceof ApiError && event.error.status === 404;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-serif text-3xl font-bold">{notFound ? t('Event not found', 'Событие не найдено') : t('Something went wrong', 'Что-то пошло не так')}</p>
        <p className="max-w-sm text-muted">{notFound ? t('Check the QR code or the link you received.', 'Проверьте QR-код или полученную ссылку.') : event.error?.message}</p>
      </div>
    );
  }

  const iconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', height: 56, gap: 12 }}>
          <Link href={`/e/${slug}`} aria-label={t('Back to event', 'Назад к событию')}
            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
            <ArrowLeftIcon />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</p>
              {ev.status === 'active' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--accent)', borderRadius: 100, padding: '2px 8px', flexShrink: 0 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} className="live-dot" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>LIVE</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, fontWeight: 500 }}>
              {plural(ev.stats.photos, 'photo')} · {plural(ev.stats.guests, 'guest')}
            </p>
          </div>
          <LanguageToggle style={{ flexShrink: 0, height: 34, padding: '0 9px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 12, fontWeight: 700 }} />
          <button onClick={toggleDark} aria-label={dark ? t('Switch to light mode', 'Светлая тема') : t('Switch to dark mode', 'Тёмная тема')}
            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
            {dark ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>

        {/* Sort tabs */}
        {canSee && (
          <div style={{ display: 'flex', padding: '0 16px 10px', gap: 6, maxWidth: 1400, margin: '0 auto', overflowX: 'auto' }} className="no-scroll" role="tablist">
            {(['newest', 'popular', ...(session ? ['mine'] : [])] as SortMode[]).map(s => (
              <button key={s} onClick={() => setSort(s)} role="tab" aria-selected={sort === s}
                style={{ flexShrink: 0, padding: '6px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', background: sort === s ? 'var(--accent)' : 'var(--surface)', color: sort === s ? '#fff' : 'var(--text-2)', border: sort === s ? '1.5px solid transparent' : '1px solid var(--border)' }}>
                {s === 'newest' ? t('Newest', 'Новые') : s === 'popular' ? t('Popular', 'Популярные') : t('My photos', 'Мои фото')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── New photos notification ───────────────────────────── */}
      {incoming.length > 0 && sort === 'newest' && (
        <div style={{ position: 'fixed', top: 112, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 40 }} className="notif-slide">
          <button onClick={showIncoming}
            style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 100, background: 'var(--text)', color: 'var(--bg)', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-lg)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            ↑ {incoming.length} new photo{incoming.length === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {/* ── Masonry grid ─────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '10px 8px calc(120px + env(safe-area-inset-bottom))', maxWidth: 1400, width: '100%', margin: '0 auto' }} className="sm:px-4">
        {!canSee ? (
          <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-3 text-center">
            <p className="font-serif text-2xl font-bold">{t('This wall is private', 'Это закрытая стена')}</p>
            <p className="text-muted">{t('Enter the event PIN to see the photos.', 'Введите PIN события, чтобы увидеть фото.')}</p>
            <Link href={`/e/${slug}`} className="btn-press mt-2 rounded-[10px] bg-accent px-5 py-2.5 font-semibold text-white">{t('Enter PIN', 'Ввести PIN')}</Link>
          </div>
        ) : feedLoading ? (
          <div className="flex justify-center py-24"><Spinner /></div>
        ) : feed.error ? (
          <p className="py-24 text-center text-muted">{feed.error}</p>
        ) : items.length === 0 ? (
          <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-2 text-center">
            <p className="font-serif text-2xl font-bold">{sort === 'mine' ? t('No photos from you yet', 'Вы ещё не загружали фото') : t('The wall is empty', 'На стене пока пусто')}</p>
            <p className="text-muted">{ev.status === 'closed' ? t('This event is closed.', 'Событие завершено.') : t('Be the first to share a moment!', 'Поделитесь первым моментом!')}</p>
          </div>
        ) : (
          <div className="masonry">
            {items.map(photo => (
              <div key={photo.id} className="masonry-item" style={{ position: 'relative' }}>
                <div
                  role="button" tabIndex={0} aria-label={t(`Open photo by ${photo.author}`, `Открыть фото от ${photo.author}`)}
                  onClick={() => handleTap(photo)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPhoto(photo.id); } }}
                  style={{ borderRadius: 10, overflow: 'hidden', position: 'relative', cursor: 'pointer', background: 'var(--border)' }}
                  className="photo-hover">
                  <img src={photo.thumbUrl} alt={photo.caption ?? ''} style={{ width: '100%', display: 'block', objectFit: 'cover', opacity: photo.status === 'pending' ? 0.5 : 1 }} loading="lazy" />
                  {photo.status === 'pending' && (
                    <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 100, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700 }}>{t('Awaiting approval', 'На проверке')}</span>
                  )}
                  {heartAnim === photo.id && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 72 }} className="heart-pop">❤️</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)', opacity: 0, transition: 'opacity 200ms' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')} />
                  {photo.totalReactions > 0 && (
                    <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 100, padding: '3px 8px', backdropFilter: 'blur(4px)' }}>
                      <span style={{ fontSize: 11 }}>{photo.myReaction ?? '❤️'}</span>
                      <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{photo.totalReactions}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={sentinel} aria-hidden="true" />
        {loadingMore && <div className="flex justify-center py-6"><Spinner /></div>}
      </div>

      {/* ── Floating upload button ────────────────────────────── */}
      {ev.status !== 'closed' && (
        <div style={{ position: 'fixed', bottom: 'max(24px, calc(12px + env(safe-area-inset-bottom)))', left: '50%', transform: 'translateX(-50%)', zIndex: 35 }}>
          <Link href={`/e/${slug}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 100, background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, boxShadow: '0 8px 32px rgba(225,29,72,0.4)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}
            className="btn-press">
            <PlusIcon /> Upload photo
          </Link>
        </div>
      )}

      {/* ── Photo Viewer overlay ─────────────────────────────── */}
      {selectedPhoto && (
        <div role="dialog" aria-modal="true" aria-label={t('Photo viewer', 'Просмотр фото')} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column' }}
          className="fade-in">
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 'max(14px, env(safe-area-inset-top)) 16px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {initials(selectedPhoto.author)}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#fff', fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPhoto.author}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0 }}>{timeAgo(selectedPhoto.createdAt)}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, position: 'relative' }}>
              {ev.settings.allowDownloads && (
                <button onClick={handleDownload} aria-label={t('Download photo', 'Скачать фото')} style={iconBtn}><DownloadIcon /></button>
              )}
              {selectedPhoto.mine ? (
                <button onClick={handleDelete} aria-label={t('Delete my photo', 'Удалить моё фото')} style={iconBtn}><TrashIcon /></button>
              ) : (
                <button onClick={() => setReportOpen(o => !o)} aria-label={t('Report photo', 'Пожаловаться')} aria-expanded={reportOpen} style={{ ...iconBtn, color: 'rgba(255,255,255,0.6)' }}><FlagIcon /></button>
              )}
              <button onClick={closeViewer} aria-label={t('Close viewer', 'Закрыть просмотр')} style={iconBtn}><XIcon /></button>

              {reportOpen && (
                <div role="menu" style={{ position: 'absolute', top: 44, right: 0, width: 240, background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 2 }} className="scale-in">
                  <p style={{ margin: 0, padding: '8px 10px 6px', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('Report photo', 'Пожаловаться на фото')}</p>
                  {REPORT_REASONS.map(r => (
                    <button key={r.value} role="menuitem" onClick={() => handleReport(r.value)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px', borderRadius: 9, border: 'none', background: 'none', fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      {t(r.label, r.ru)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Photo */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              if (touchStartX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (dx > 50) showPrev(); else if (dx < -50) showNext();
            }}>
            <button onClick={showPrev} aria-label={t('Previous photo', 'Предыдущее фото')} disabled={!hasPrev} className="hidden sm:flex"
              style={{ opacity: hasPrev ? 1 : 0.3, position: 'absolute', left: 12, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 1 }}>
              <ChevronLeftIcon />
            </button>
            <img key={selectedPhoto.id} src={selectedPhoto.url} alt={selectedPhoto.caption ?? ''} className="fade-in"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', userSelect: 'none' }} draggable={false} />
            <button onClick={showNext} aria-label={t('Next photo', 'Следующее фото')} disabled={!hasNext} className="hidden sm:flex"
              style={{ opacity: hasNext ? 1 : 0.3, position: 'absolute', right: 12, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 1 }}>
              <ChevronRightIcon />
            </button>
          </div>

          {/* Bottom info + reactions */}
          <div style={{ flexShrink: 0, width: '100%', maxWidth: 720, margin: '0 auto', padding: '14px 16px max(20px, env(safe-area-inset-bottom))' }}>
            {selectedPhoto.caption && (
              <p style={{ color: '#fff', fontSize: 15, margin: '0 0 16px', fontWeight: 500, lineHeight: 1.5 }}>{selectedPhoto.caption}</p>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {ev.settings.allowReactions && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', flex: 1, minWidth: 0 }} className="no-scroll">
                  {REACTION_EMOJIS.map(emoji => {
                    const count = selectedPhoto.reactions[emoji] ?? 0;
                    const active = selectedPhoto.myReaction === emoji;
                    return (
                      <button key={emoji} onClick={() => handleReact(selectedPhoto, emoji)} aria-pressed={active} aria-label={t(`React ${emoji}`, `Реакция ${emoji}`)}
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 9px', borderRadius: 100, border: `1.5px solid ${active ? 'var(--accent)' : 'rgba(255,255,255,0.18)'}`, background: active ? 'rgba(225,29,72,0.18)' : 'rgba(255,255,255,0.06)', cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'all 150ms' }}
                        className="btn-press">
                        <span style={{ fontSize: 16 }}>{emoji}</span>
                        <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {ev.settings.allowComments && (
                <button onClick={openComments} aria-label={t('Show comments', 'Показать комментарии')}
                  style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 100, border: '1.5px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', color: '#fff' }}>
                  <MessageIcon />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedPhoto.commentCount}</span>
                </button>
              )}
            </div>
          </div>

          {/* Comments sheet */}
          {showComments && (
            <div role="dialog" aria-label={t('Comments', 'Комментарии')} style={{ position: 'absolute', background: 'var(--surface)', display: 'flex', flexDirection: 'column', color: 'var(--text)' }}
              className="slide-up inset-x-0 bottom-0 max-h-[70dvh] rounded-t-[20px] px-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-4 sm:max-h-none sm:w-[380px] sm:rounded-[20px] sm:pt-4 sm:shadow-2xl">
              <div className="sheet-handle" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 16px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('Comments', 'Комментарии')} ({comments?.length ?? selectedPhoto.commentCount})</h4>
                <button onClick={() => setShowComments(false)} aria-label={t('Close comments', 'Закрыть комментарии')} style={{ width: 36, height: 36, marginRight: -8, alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}><XIcon /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16, minHeight: 80 }} className="no-scroll">
                {comments === null ? (
                  <div className="flex justify-center py-6"><Spinner /></div>
                ) : comments.length === 0 ? (
                  <p style={{ margin: 0, padding: '16px 0', textAlign: 'center', fontSize: 14, color: 'var(--text-2)' }}>{t('No comments yet. Say something nice!', 'Комментариев пока нет. Напишите что-нибудь приятное!')}</p>
                ) : comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                    <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {initials(c.author)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.author}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{timeAgo(c.createdAt)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); handleSendComment(); }}>
                <input value={newComment} onChange={e => setNewComment(e.target.value)} maxLength={500}
                  placeholder={t('Write a comment…', 'Напишите комментарий…')} aria-label={t('Write a comment', 'Написать комментарий')} enterKeyHint="send"
                  style={{ flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 100, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'inherit' }} />
                <button type="submit" aria-label={t('Send comment', 'Отправить комментарий')} disabled={!newComment.trim()}
                  style={{ width: 40, height: 40, borderRadius: '50%', background: newComment.trim() ? 'var(--accent)' : 'var(--border)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                  <SendIcon />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
