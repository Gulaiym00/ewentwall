'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Icon } from '@/ui/icons';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, PageHeader, Tabs, Toggle, type Tone } from '@/ui';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/client';
import type { AdminReview as Review, ReviewStatus } from '@/api/types';
import { formatDate } from '@/utils/format';
import { useAdmin } from '@/hooks/useAdmin';
import { useApi } from '@/hooks/useApi';
import { LoadError, PageLoader } from '@/ui/loader';
import { useT } from '@/utils/locale';
import { reviewStatusLabel } from '@/utils/labels';

const MAX_FEATURED = 3;
const STATUS_TONE: Record<ReviewStatus, Tone> = { published: 'success', pending: 'warning', hidden: 'neutral' };

function Stars({ rating }: { rating: number }) {
  const t = useT();
  return (
    <span className="flex gap-0.5 text-[#F59E0B]" role="img" aria-label={t(`${rating} out of 5 stars`, `${rating} из 5 звёзд`)}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export default function AdminReviews() {
  const t = useT();
  const toast = useToast();
  const { refreshCounts } = useAdmin();
  const [tab, setTab] = useState<'all' | ReviewStatus>('all');
  const [deleting, setDeleting] = useState<Review | null>(null);
  const all = useApi(() => adminApi.reviews(), []);
  const reviews = all.data?.items ?? [];

  const run = async (action: () => Promise<unknown>, message: string, tone: 'success' | 'danger' = 'success') => {
    try {
      await action();
      toast(message, tone);
      all.reload();
      refreshCounts();
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };
  const updateReview = (r: Review, patch: { status?: ReviewStatus; featured?: boolean }, message: string) =>
    run(() => adminApi.updateReview(r.id, patch), message);

  const featuredCount = reviews.filter(r => r.featured).length;
  const avg = reviews.filter(r => r.status === 'published').reduce((s, r, _, a) => s + r.rating / a.length, 0);
  const list = reviews.filter(r => tab === 'all' || r.status === tab);
  const count = (s: ReviewStatus) => reviews.filter(r => r.status === s).length;

  const setFeatured = (r: Review, on: boolean) => {
    if (on && featuredCount >= MAX_FEATURED) { toast(t(`Only ${MAX_FEATURED} reviews can be featured`, `На главной может быть не больше ${MAX_FEATURED} отзывов`), 'danger'); return; }
    updateReview(r, { featured: on }, on ? t('Shown on the landing page', 'Показан на главной') : t('Removed from the landing page', 'Убран с главной'));
  };

  return (
    <>
      <PageHeader title={t('Reviews', 'Отзывы')}
        description={t(`Average rating ${avg.toFixed(1)} · ${featuredCount}/${MAX_FEATURED} featured on the landing page`,
          `Средняя оценка ${avg.toFixed(1)} · на главной ${featuredCount}/${MAX_FEATURED}`)} />

      <Tabs value={tab} onChange={setTab} className="mb-4" tabs={[
        { value: 'all', label: t('All', 'Все'), count: reviews.length },
        { value: 'pending', label: reviewStatusLabel(t, 'pending'), count: count('pending') },
        { value: 'published', label: reviewStatusLabel(t, 'published'), count: count('published') },
        { value: 'hidden', label: reviewStatusLabel(t, 'hidden'), count: count('hidden') },
      ]} />

      {all.loading && !all.data ? (
        <PageLoader label={t('Loading reviews…', 'Загружаем отзывы…')} />
      ) : all.error && !all.data ? (
        <LoadError message={all.error.message} onRetry={all.reload} />
      ) : list.length === 0 ? (
        <Card><EmptyState icon="star" title={t('No reviews', 'Отзывов нет')} /></Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
          {list.map(r => (
            <li key={r.id} className="min-w-0">
              <Card className="flex h-full flex-col">
                <div className="flex items-start gap-3">
                  <Avatar src={r.avatarUrl ?? undefined} name={r.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="truncate text-xs text-muted">{[r.event, formatDate(r.createdAt.slice(0, 10))].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Badge tone={STATUS_TONE[r.status]} dot>{reviewStatusLabel(t, r.status)}</Badge>
                </div>
                <div className="mt-3"><Stars rating={r.rating} /></div>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed">“{r.text}”</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {r.status === 'published' ? (
                    <label className="mr-auto flex items-center gap-2.5 text-[13px] font-semibold">
                      <Toggle checked={r.featured} onChange={v => setFeatured(r, v)} label={t('Feature on landing page', 'Показывать на главной')} />
                      {t('Feature on landing', 'На главной')}
                    </label>
                  ) : <span className="mr-auto" />}
                  {r.status !== 'published' && (
                    <Button size="sm" icon="check" onClick={() => updateReview(r, { status: 'published' }, t('Review published', 'Отзыв опубликован'))}>{t('Publish', 'Опубликовать')}</Button>
                  )}
                  {r.status !== 'hidden' && (
                    <Button size="sm" variant="ghost" icon="eyeOff" onClick={() => updateReview(r, { status: 'hidden' }, t('Review hidden', 'Отзыв скрыт'))}>{t('Hide', 'Скрыть')}</Button>
                  )}
                  <IconButton icon="trash" label={t('Delete review', 'Удалить отзыв')} onClick={() => setDeleting(r)} className="hover:text-danger" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
        <Icon name="globe" size={13} /> {t('Featured reviews appear in the “Loved by event organizers” section of the landing page.', 'Выбранные отзывы показываются на главной в разделе «Отзывы».')}
      </p>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title={t('Delete review?', 'Удалить отзыв?')} confirmLabel={t('Delete', 'Удалить')}
        description={t(`The review by ${deleting?.name} will be permanently deleted.`, `Отзыв от ${deleting?.name} будет удалён навсегда.`)}
        onConfirm={() => { if (deleting) run(() => adminApi.deleteReview(deleting.id), t('Review deleted', 'Отзыв удалён'), 'danger'); }} />
    </>
  );
}
