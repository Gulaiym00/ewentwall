'use client';

import { useMemo, useState } from 'react';
import { Icon, type IconName } from '@/ui/icons';
import { Badge, Button, Card, EmptyState, PageHeader, SearchInput, Select, type Tone } from '@/ui';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/client';
import type { AuditCategory, AuditEntry } from '@/api/types';
import { useToast } from '@/components/Toast';
import { useApi } from '@/hooks/useApi';
import { useDebounced } from '@/hooks/useDebounced';
import { LoadError, PageLoader } from '@/ui/loader';
import { formatDateTime } from '@/utils/format';
import { useT } from '@/utils/locale';
import { auditText, roleLabel } from '@/utils/labels';

const PAGE = 200;
/** Local calendar day (the API sends UTC timestamps). */
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CATEGORY: Record<AuditCategory, { label: string; ru: string; icon: IconName; tone: Tone }> = {
  auth: { label: 'Auth', ru: 'Вход', icon: 'key', tone: 'info' },
  user: { label: 'Users', ru: 'Пользователи', icon: 'users', tone: 'accent' },
  event: { label: 'Events', ru: 'События', icon: 'calendar', tone: 'success' },
  moderation: { label: 'Moderation', ru: 'Модерация', icon: 'shield', tone: 'danger' },
  content: { label: 'Content', ru: 'Контент', icon: 'file', tone: 'neutral' },
  settings: { label: 'Settings', ru: 'Настройки', icon: 'settings', tone: 'warning' },
};

const dayLabel = (iso: string) => formatDateTime(iso, { weekday: 'long', month: 'long', day: 'numeric' });
const time = (iso: string) => formatDateTime(iso, { hour: '2-digit', minute: '2-digit', hour12: false });

function toCsv(rows: AuditEntry[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['Time', 'Actor', 'Role', 'Category', 'Action', 'Target', 'IP'];
  return [header, ...rows.map(r => [r.at, r.actor, r.actorRole, r.category, r.action, r.target, r.ip])]
    .map(line => line.map(esc).join(','))
    .join('\n');
}

export default function AdminAudit() {
  const t = useT();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | AuditCategory>('all');
  const search = useDebounced(query.trim(), 300);
  const filterKey = `${search}|${category}`;
  const first = useApi(() => adminApi.audit({ query: search || undefined, category: category === 'all' ? undefined : category, limit: PAGE }), [search, category]);
  // Older pages loaded with "Load more", kept per filter
  const [more, setMore] = useState<{ key: string; items: AuditEntry[]; next: string | null }>({ key: '', items: [], next: null });
  const [loadingMore, setLoadingMore] = useState(false);

  const extra = more.key === filterKey ? more : null;
  const filtered = useMemo(() => [...(first.data?.items ?? []), ...(extra?.items ?? [])], [first.data, extra]);
  const nextCursor = extra ? extra.next : first.data?.nextCursor ?? null;

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await adminApi.audit({ query: search || undefined, category: category === 'all' ? undefined : category, cursor: nextCursor, limit: PAGE });
      setMore(m => ({ key: filterKey, items: [...(m.key === filterKey ? m.items : []), ...page.items], next: page.nextCursor }));
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const a of filtered) {
      const day = localDay(a.at);
      map.set(day, [...(map.get(day) ?? []), a]);
    }
    return [...map.entries()];
  }, [filtered]);

  const exportCsv = () => {
    const blob = new Blob(['﻿' + toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `audit-log-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title={t('Audit log', 'Журнал действий')}
        description={t('Every sign-in and change made by admins, organizers and the system.', 'Все входы и изменения админов, организаторов и системы.')}
        actions={<Button icon="download" onClick={exportCsv} disabled={filtered.length === 0}>{t('Export CSV', 'Экспорт CSV')}</Button>} />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px]">
        <SearchInput value={query} onChange={setQuery} placeholder={t('Search actor, action, target or IP', 'Поиск по автору, действию, объекту или IP')} />
        <Select aria-label={t('Filter by category', 'Фильтр по категории')} value={category} onChange={e => setCategory(e.target.value as typeof category)}
          options={[{ value: 'all', label: t('All categories', 'Все категории') }, ...Object.entries(CATEGORY).map(([value, c]) => ({ value, label: t(c.label, c.ru) }))]} />
      </div>

      {first.loading && !first.data ? (
        <PageLoader label={t('Loading audit log…', 'Загружаем журнал…')} />
      ) : first.error && !first.data ? (
        <LoadError message={first.error.message} onRetry={first.reload} />
      ) : groups.length === 0 ? (
        <Card><EmptyState icon="history" title={t('No matching entries', 'Ничего не найдено')} /></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, entries]) => (
            <section key={day}>
              <h2 className="mb-2 text-[13px] font-bold tracking-wider text-muted uppercase">{dayLabel(day + 'T00:00:00')}</h2>
              <Card padded={false}>
                <ul className="divide-y divide-line">
                  {entries.map(a => {
                    const c = CATEGORY[a.category];
                    return (
                      <li key={a.id} className="flex gap-3 px-4 py-3 md:items-center md:px-5">
                        <time dateTime={a.at} className="w-11 shrink-0 pt-0.5 text-xs font-semibold text-muted tabular-nums md:pt-0">{time(a.at)}</time>
                        <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-bg text-muted sm:flex"><Icon name={c.icon} size={15} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-semibold">{a.actor === 'system' ? t('system', 'система') : a.actor}</span>
                            <span className="text-muted"> · {roleLabel(t, a.actorRole)}</span>
                          </p>
                          <p className="text-sm">{auditText(t, a.action)} <span className="text-muted">→ {auditText(t, a.target)}</span></p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted md:hidden">IP {a.ip}</p>
                        </div>
                        <span className="hidden w-28 shrink-0 font-mono text-xs text-muted md:block">{a.ip}</span>
                        <span className="shrink-0"><Badge tone={c.tone}>{t(c.label, c.ru)}</Badge></span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
          {nextCursor && (
            <div className="flex justify-center">
              <Button onClick={loadMore} disabled={loadingMore}>{loadingMore ? t('Loading…', 'Загрузка…') : t('Load older entries', 'Показать более ранние')}</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
