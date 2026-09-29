'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Icon } from '@/ui/icons';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Select, Tabs } from '@/ui';
import { cx } from '@/utils/cx';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/client';
import type { ReportGroup as PhotoReport, ReportStatus } from '@/api/types';
import { useAdmin } from '@/hooks/useAdmin';
import { useApi } from '@/hooks/useApi';
import { LoadError, PageLoader } from '@/ui/loader';
import { timeAgo } from '@/utils/format';
import { useT } from '@/utils/locale';
import { reportReasonLabel } from '@/utils/labels';

const aiTone = (score: number) => (score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'success');
const AI_BAR: Record<string, string> = { danger: 'bg-danger', warning: 'bg-warning', success: 'bg-success' };

export default function AdminModeration() {
  const t = useT();
  const toast = useToast();
  const { refreshCounts } = useAdmin();
  const [tab, setTab] = useState<ReportStatus>('pending');
  const [sort, setSort] = useState<'ai' | 'reports' | 'recent'>('ai');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PhotoReport | null>(null);
  const reports = useApi(() => adminApi.reports({ status: tab, sort }), [tab, sort]);

  const list = reports.data?.items ?? [];
  const count = (s: ReportStatus) => reports.data?.counts[s] ?? 0;

  const act = async (ids: string[], action: 'keep' | 'remove' | 'reopen') => {
    try {
      await adminApi.resolveReports(ids, action);
      setSelected(new Set());
      setPreview(null);
      reports.reload();
      refreshCounts();
      const many = ids.length > 1;
      const what = many ? t.count(ids.length, ['photo', 'photos'], ['фото', 'фото', 'фото']) : t('Photo', 'Фото');
      toast(
        action === 'remove' ? t(`${what} removed from the wall`, `${what}: убрано со стены`)
          : action === 'keep' ? t(`${what} kept on the wall`, `${what}: оставлено на стене`)
            : t('Moved back to pending', 'Возвращено на проверку'),
        action === 'remove' ? 'danger' : 'success',
      );
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };
  const resolve = (ids: string[], status: 'approved' | 'removed') => act(ids, status === 'removed' ? 'remove' : 'keep');

  const toggle = (id: string) => setSelected(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const changeTab = (v: ReportStatus) => { setTab(v); setSelected(new Set()); };

  return (
    <>
      <PageHeader title={t('Moderation', 'Модерация')}
        description={t('Reported photos from every event. High AI scores are reviewed first.', 'Фото с жалобами со всех событий. Сначала — с высокой оценкой AI.')} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={changeTab} tabs={[
          { value: 'pending', label: t('Pending', 'На проверке'), count: count('pending') },
          { value: 'approved', label: t('Kept', 'Оставлены'), count: count('approved') },
          { value: 'removed', label: t('Removed', 'Удалены'), count: count('removed') },
        ]} />
        <Select aria-label={t('Sort reports', 'Сортировка')} value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="sm:w-48"
          options={[
            { value: 'ai', label: t('Highest AI score', 'Высокая оценка AI') },
            { value: 'reports', label: t('Most reports', 'Больше жалоб') },
            { value: 'recent', label: t('Most recent', 'Сначала новые') },
          ]} />
      </div>

      {/* Bulk bar */}
      {tab === 'pending' && selected.size > 0 && (
        <div className="fade-in sticky top-[72px] z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 pl-4 shadow-md">
          <span className="mr-auto text-sm font-semibold">{t(`${selected.size} selected`, `Выбрано: ${selected.size}`)}</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t('Clear', 'Сбросить')}</Button>
          <Button size="sm" icon="check" onClick={() => resolve([...selected], 'approved')}>{t('Keep', 'Оставить')}</Button>
          <Button size="sm" variant="danger" icon="trash" onClick={() => resolve([...selected], 'removed')}>{t('Remove', 'Убрать')}</Button>
        </div>
      )}

      {reports.loading && !reports.data ? (
        <PageLoader label={t('Loading reports…', 'Загружаем жалобы…')} />
      ) : reports.error && !reports.data ? (
        <LoadError message={reports.error.message} onRetry={reports.reload} />
      ) : list.length === 0 ? (
        <Card><EmptyState icon="shield" title={tab === 'pending' ? t('Queue is clear', 'Очередь пуста') : t('Nothing here yet', 'Здесь пока пусто')}
          description={tab === 'pending' ? t('No reported photos need review right now.', 'Сейчас нет фото, которые нужно проверить.') : undefined} /></Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {list.map(r => {
            const tone = aiTone(r.aiScore ?? 0);
            const isSel = selected.has(r.photoId);
            return (
              <li key={r.photoId}>
                <Card padded={false} className={cx('overflow-hidden transition-shadow', isSel && 'ring-2 ring-accent')}>
                  <div className="relative">
                    <button type="button" onClick={() => setPreview(r)} className="block w-full" aria-label={t(`Preview photo from ${r.event.name}`, `Открыть фото: ${r.event.name}`)}>
                      <img src={r.photoUrl} alt="" className={cx('aspect-[4/3] w-full bg-line object-cover', tab === 'removed' && 'blur-md grayscale')} />
                    </button>
                    {tab === 'pending' && (
                      <label className="absolute top-3 left-3 flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/50 backdrop-blur">
                        <input type="checkbox" checked={isSel} onChange={() => toggle(r.photoId)} className="size-4 accent-[var(--accent)]" aria-label={t('Select photo', 'Выбрать фото')} />
                      </label>
                    )}
                    <span className="absolute top-3 right-3"><Badge tone="danger"><Icon name="flag" size={11} /> {r.reports}</Badge></span>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{r.event.name}</p>
                        <p className="truncate text-xs text-muted">{t('by', 'от')} {r.author} · {timeAgo(r.reportedAt)}</p>
                      </div>
                      <span className="capitalize"><Badge tone="neutral">{reportReasonLabel(t, r.reason)}</Badge></span>
                    </div>

                    {r.aiScore === null ? (
                      <p className="mt-3 text-xs text-muted">{t('Not checked by AI', 'AI не проверял')}</p>
                    ) : (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted">{t('AI risk score', 'Оценка риска AI')}</span>
                        <span className="font-bold tabular-nums">{r.aiScore}/100</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={r.aiScore} aria-valuemin={0} aria-valuemax={100} aria-label={t('AI risk score', 'Оценка риска AI')}>
                        <div className={cx('h-full rounded-full', AI_BAR[tone])} style={{ width: `${r.aiScore}%` }} />
                      </div>
                    </div>
                    )}

                    {tab === 'pending' ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button size="sm" icon="check" onClick={() => resolve([r.photoId], 'approved')}>{t('Keep', 'Оставить')}</Button>
                        <Button size="sm" variant="danger" icon="trash" onClick={() => resolve([r.photoId], 'removed')}>{t('Remove', 'Убрать')}</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="mt-3 w-full" onClick={() => act([r.photoId], 'reopen')}>
                        {t('Reopen', 'Вернуть на проверку')}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.event.name ?? ''}
        footer={preview?.status === 'pending' && <>
          <Button icon="check" onClick={() => preview && resolve([preview.photoId], 'approved')}>{t('Keep', 'Оставить')}</Button>
          <Button variant="danger" icon="trash" onClick={() => preview && resolve([preview.photoId], 'removed')}>{t('Remove', 'Убрать')}</Button>
        </>}>
        {preview && (
          <>
            <img src={preview.photoUrl} alt="" className="max-h-[50dvh] w-full rounded-xl bg-line object-contain" />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">{t('Reason', 'Причина')}</dt><dd className="font-semibold capitalize">{reportReasonLabel(t, preview.reason)}</dd></div>
              <div><dt className="text-xs text-muted">{t('Reports', 'Жалоб')}</dt><dd className="font-semibold">{preview.reports}</dd></div>
              <div><dt className="text-xs text-muted">{t('Uploaded by', 'Загрузил(а)')}</dt><dd className="font-semibold">{preview.author}</dd></div>
              <div><dt className="text-xs text-muted">{t('AI risk score', 'Оценка риска AI')}</dt><dd className="font-semibold">{preview.aiScore === null ? t('Not checked', 'Не проверено') : `${preview.aiScore}/100`}</dd></div>
            </dl>
          </>
        )}
      </Modal>
    </>
  );
}
