'use client';

import Link from 'next/link';
import UploadsChart from '@/widgets/uploads-chart';
import { Icon, type IconName } from '@/ui/icons';
import { Avatar, Badge, Card, CardHeader, PageHeader } from '@/ui';
import { cx } from '@/utils/cx';
import { adminApi } from '@/api/admin';
import { useAdmin } from '@/hooks/useAdmin';
import { useApi } from '@/hooks/useApi';
import { LoadError, PageLoader } from '@/ui/loader';
import { formatNumber, timeAgo } from '@/utils/format';
import { useT } from '@/utils/locale';
import { auditText, reportReasonLabel, roleLabel } from '@/utils/labels';

function Kpi({ label, value, delta, icon, children }: { label: string; value: string; delta?: number; icon: IconName; children?: React.ReactNode }) {
  const t = useT();
  const up = (delta ?? 0) >= 0;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent"><Icon name={icon} size={17} /></span>
        {delta !== undefined && (
          <span className={cx('inline-flex items-center gap-1 text-xs font-bold tabular-nums', up ? 'text-success' : 'text-danger')}>
            <Icon name={up ? 'trendUp' : 'trendDown'} size={13} />
            {up ? '+' : ''}{delta}%
            <span className="sr-only">{t('vs previous 7 days', 'к прошлым 7 дням')}</span>
          </span>
        )}
      </div>
      <p className="mt-3 text-[clamp(22px,3vw,28px)] leading-tight font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-[13px] font-medium text-muted">{label}</p>
      {children}
    </Card>
  );
}

export default function AdminDashboard() {
  const t = useT();
  const { stats: s, statsError, refreshCounts } = useAdmin();
  const queue = useApi(() => adminApi.reports({ status: 'pending', sort: 'ai' }), []);
  const users = useApi(() => adminApi.users({ pageSize: 4 }), []);
  const audit = useApi(() => adminApi.audit({ limit: 5 }), []);

  if (!s) return statsError ? <LoadError message={statsError.message} onRetry={refreshCounts} /> : <PageLoader label={t('Loading dashboard…', 'Загружаем панель…')} />;

  const storagePct = s.storageTotalGb ? Math.round((s.storageUsedGb / s.storageTotalGb) * 100) : 0;
  const pending = queue.data?.items ?? [];
  const newest = users.data?.items ?? [];

  return (
    <>
      <PageHeader title={t('Dashboard', 'Панель')} description={t('Platform health and activity at a glance.', 'Состояние и активность платформы.')} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Kpi label={t('Registered users', 'Пользователей')} value={formatNumber(s.users)} delta={s.usersDelta} icon="users" />
        <Kpi label={t('Active events', 'Активных событий')} value={String(s.activeEvents)} delta={s.activeEventsDelta} icon="calendar" />
        <Kpi label={t('Photos today', 'Фото сегодня')} value={formatNumber(s.photosToday)} delta={s.photosDelta} icon="camera" />
        <Kpi label={t(`Storage · ${s.storageUsedGb} of ${s.storageTotalGb} GB`, `Хранилище · ${s.storageUsedGb} из ${s.storageTotalGb} ГБ`)} value={`${storagePct}%`} icon="database">
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={storagePct} aria-valuemin={0} aria-valuemax={100} aria-label={t('Storage used', 'Занято')}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${storagePct}%` }} />
          </div>
        </Kpi>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <UploadsChart data={s.uploads14d} />
        </Card>

        <Card>
          <CardHeader title={t('Moderation queue', 'Очередь модерации')}
            action={<Link href="/admin/moderation" className="text-[13px] font-semibold text-accent hover:underline">{t('Review all', 'Смотреть все')}</Link>} />
          {pending.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{t('Nothing to review 🎉', 'Проверять нечего 🎉')}</p>
          ) : (
            <ul className="space-y-3">
              {pending.slice(0, 4).map(r => (
                <li key={r.photoId} className="flex items-center gap-3">
                  <img src={r.photoUrl} alt="" className="size-11 shrink-0 rounded-lg bg-line object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.event.name}</p>
                    <p className="truncate text-xs text-muted capitalize">{reportReasonLabel(t, r.reason)} · {t.count(r.reports, ['report', 'reports'], ['жалоба', 'жалобы', 'жалоб'])} · {timeAgo(r.reportedAt)}</p>
                  </div>
                  {r.aiScore !== null && <Badge tone={r.aiScore >= 70 ? 'danger' : r.aiScore >= 40 ? 'warning' : 'neutral'}>AI {r.aiScore}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t('New users', 'Новые пользователи')}
            action={<Link href="/admin/users" className="text-[13px] font-semibold text-accent hover:underline">{t('All users', 'Все пользователи')}</Link>} />
          <ul className="space-y-3">
            {newest.map(u => (
              <li key={u.id} className="flex items-center gap-3">
                <Avatar src={u.avatarUrl ?? undefined} name={u.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.name}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                <Badge tone={u.status === 'pending' ? 'warning' : u.status === 'blocked' ? 'danger' : 'neutral'}>{roleLabel(t, u.role)}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('Recent admin activity', 'Последние действия админов')}
            action={<Link href="/admin/audit" className="text-[13px] font-semibold text-accent hover:underline">{t('Audit log', 'Журнал')}</Link>} />
          <ul className="divide-y divide-line">
            {(audit.data?.items ?? []).map(a => (
              <li key={a.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><span className="font-semibold">{a.actor}</span> <span className="text-muted">·</span> {auditText(t, a.action)}</p>
                  <p className="truncate text-xs text-muted">{auditText(t, a.target)}</p>
                </div>
                <time dateTime={a.at} className="shrink-0 text-xs text-muted tabular-nums">
                  {new Date(a.at).toLocaleTimeString(t.locale === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
