'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, PageHeader, Tabs, type Tone } from '@/ui';
import { Icon } from '@/ui/icons';
import { errorMessage } from '@/api/client';
import { supportApi, type SupportTicket, type SupportTopic, type TicketStatus } from '@/api/support';
import { timeAgo } from '@/utils/format';
import { useAdmin } from '@/hooks/useAdmin';
import { useApi } from '@/hooks/useApi';
import { LoadError, PageLoader } from '@/ui/loader';
import { useT } from '@/utils/locale';
import { roleLabel } from '@/utils/labels';

const STATUS_TONE: Record<TicketStatus, Tone> = { open: 'warning', resolved: 'success' };

export default function AdminSupport() {
  const t = useT();
  const toast = useToast();
  const { refreshCounts } = useAdmin();
  const [tab, setTab] = useState<'all' | TicketStatus>('open');
  const [deleting, setDeleting] = useState<SupportTicket | null>(null);
  const all = useApi(() => supportApi.tickets(), []);
  const tickets = all.data?.items ?? [];
  const list = tickets.filter(x => tab === 'all' || x.status === tab);
  const count = (s: TicketStatus) => tickets.filter(x => x.status === s).length;

  const TOPIC: Record<SupportTopic, string> = {
    password: t("Can't sign in", 'Не может войти'),
    account: t('Account', 'Аккаунт'),
    event: t('Event / photos', 'Событие / фото'),
    other: t('Other', 'Другое'),
  };

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

  const replyLink = (x: SupportTicket) =>
    `mailto:${x.email}?subject=${encodeURIComponent(t('EventWall support', 'Поддержка EventWall'))}&body=${encodeURIComponent(`\n\n> ${x.message.replace(/\n/g, '\n> ')}`)}`;

  return (
    <>
      <PageHeader title={t('Support', 'Поддержка')}
        description={t('Messages from the support form. For “can’t sign in”, set a new password for the account and send it to the user.',
          'Сообщения из формы поддержки. Если человек не может войти — поставьте аккаунту новый пароль и отправьте его пользователю.')} />

      <Tabs value={tab} onChange={setTab} className="mb-4" tabs={[
        { value: 'open', label: t('Open', 'Открытые'), count: count('open') },
        { value: 'resolved', label: t('Resolved', 'Решённые'), count: count('resolved') },
        { value: 'all', label: t('All', 'Все'), count: tickets.length },
      ]} />

      {all.loading && !all.data ? (
        <PageLoader label={t('Loading messages…', 'Загружаем сообщения…')} />
      ) : all.error && !all.data ? (
        <LoadError message={all.error.message} onRetry={all.reload} />
      ) : list.length === 0 ? (
        <Card><EmptyState icon="message" title={tab === 'open' ? t('No open messages', 'Новых сообщений нет') : t('No messages', 'Сообщений нет')} /></Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
          {list.map(x => (
            <li key={x.id} className="min-w-0">
              <Card className="flex h-full flex-col">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{x.name || x.email}</p>
                    <p className="truncate text-xs text-muted">{x.email} · {timeAgo(x.createdAt)}</p>
                  </div>
                  <Badge tone={STATUS_TONE[x.status]} dot>{x.status === 'open' ? t('Open', 'Открыто') : t('Resolved', 'Решено')}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={x.topic === 'password' ? 'danger' : 'neutral'}>{TOPIC[x.topic]}</Badge>
                  {x.user ? (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Icon name="user" size={13} /> {t('Account', 'Аккаунт')}: {x.user.name} · {roleLabel(t, x.user.role)}
                      {x.user.status === 'blocked' && <> · <span className="text-danger">{t('blocked', 'заблокирован')}</span></>}
                      {!x.user.hasPassword && x.user.google && <> · Google</>}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted"><Icon name="alert" size={13} /> {t('No account with this email', 'Аккаунта с таким email нет')}</span>
                  )}
                </div>

                <p className="mt-3 flex-1 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{x.message}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {x.user && (
                    <Link href={`/admin/users?query=${encodeURIComponent(x.email)}`}
                      className="btn-press inline-flex h-8 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-semibold hover:bg-bg">
                      <Icon name="lock" size={14} /> {t('Set new password', 'Новый пароль')}
                    </Link>
                  )}
                  <a href={replyLink(x)}
                    className="btn-press inline-flex h-8 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-semibold hover:bg-bg">
                    <Icon name="external" size={14} /> {t('Reply by email', 'Ответить на email')}
                  </a>
                  <span className="mr-auto" />
                  {x.status === 'open' ? (
                    <Button size="sm" variant="primary" icon="check" onClick={() => run(() => supportApi.update(x.id, 'resolved'), t('Marked as resolved', 'Отмечено как решённое'))}>
                      {t('Resolve', 'Решено')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon="history" onClick={() => run(() => supportApi.update(x.id, 'open'), t('Reopened', 'Открыто снова'))}>
                      {t('Reopen', 'Открыть снова')}
                    </Button>
                  )}
                  <IconButton icon="trash" label={t('Delete message', 'Удалить сообщение')} onClick={() => setDeleting(x)} className="hover:text-danger" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title={t('Delete message?', 'Удалить сообщение?')} confirmLabel={t('Delete', 'Удалить')}
        description={t(`The message from ${deleting?.email} will be permanently deleted.`, `Сообщение от ${deleting?.email} будет удалено навсегда.`)}
        onConfirm={() => { if (deleting) run(() => supportApi.remove(deleting.id), t('Message deleted', 'Сообщение удалено'), 'danger'); }} />
    </>
  );
}
