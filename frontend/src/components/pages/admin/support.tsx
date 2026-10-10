'use client';

import Link from 'next/link';
import { useState } from 'react';
import ChatThread, { usePolling } from '@/components/ChatThread';
import { useToast } from '@/components/Toast';
import { Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, Tabs, Textarea } from '@/ui';
import { Icon } from '@/ui/icons';
import { errorMessage } from '@/api/client';
import { supportApi, type OutgoingMessage, type SupportTicket, type SupportTopic, type TicketStatus } from '@/api/support';
import { timeAgo } from '@/utils/format';
import { cx } from '@/utils/cx';
import { useAdmin } from '@/hooks/useAdmin';
import { useApi } from '@/hooks/useApi';
import { LoadError, PageLoader } from '@/ui/loader';
import { useT } from '@/utils/locale';
import { roleLabel } from '@/utils/labels';

const ACTION = 'btn-press inline-flex h-8 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-semibold whitespace-nowrap hover:bg-bg';

/** Admin → Support: conversations on the left, the open chat on the right (one at a time on phones). */
export default function AdminSupport() {
  const t = useT();
  const toast = useToast();
  const { refreshCounts } = useAdmin();
  const [tab, setTab] = useState<'all' | TicketStatus>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SupportTicket | null>(null);

  const all = useApi(() => supportApi.tickets(), []);
  const open = useApi(() => (selectedId ? supportApi.ticket(selectedId) : Promise.resolve(undefined)), [selectedId]);
  usePolling(all.reload, 10_000);
  usePolling(() => { if (selectedId) open.reload(); }, 5000);

  const tickets = all.data?.items ?? [];
  const list = tickets.filter(x => tab === 'all' || x.status === tab);
  const count = (s: TicketStatus) => tickets.filter(x => x.status === s).length;
  const current = open.data && open.data.id === selectedId ? open.data : undefined;

  const TOPIC: Record<SupportTopic, string> = {
    password: t("Can't sign in", 'Не может войти'),
    account: t('Account', 'Аккаунт'),
    event: t('Event / photos', 'Событие / фото'),
    other: t('Other', 'Другое'),
  };

  const select = (id: string) => {
    setSelectedId(id);
    // Opening marks it read on the server; drop the local badge right away.
    all.setData(d => d && { ...d, items: d.items.map(x => (x.id === id ? { ...x, unread: 0 } : x)) });
    setTimeout(refreshCounts, 800);
  };

  /** Applies the updated conversation from the server to both the chat and the list. */
  const apply = (next: SupportTicket) => {
    open.setData(() => next);
    all.setData(d => d && { ...d, items: d.items.map(x => (x.id === next.id ? { ...next, messages: next.messages.slice(-1) } : x)) });
  };

  const reply = async (message: OutgoingMessage) => {
    if (!current) return false;
    try {
      apply(await supportApi.reply(current.id, message));
      return true;
    } catch (err) {
      toast(errorMessage(err), 'danger');
      return false;
    }
  };

  const setStatus = async (x: SupportTicket, status: TicketStatus) => {
    try {
      apply(await supportApi.update(x.id, status));
      toast(status === 'resolved' ? t('Marked as resolved', 'Отмечено как решённое') : t('Reopened', 'Открыто снова'));
      refreshCounts();
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };

  const remove = async (x: SupportTicket) => {
    try {
      await supportApi.remove(x.id);
      toast(t('Conversation deleted', 'Переписка удалена'), 'danger');
      if (selectedId === x.id) setSelectedId(null);
      all.reload();
      refreshCounts();
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };

  // Email sent by the server; the dialog is open for this conversation when `emailTo` is set.
  const [emailTo, setEmailTo] = useState<SupportTicket | null>(null);
  const [emailForm, setEmailForm] = useState({ subject: '', text: '' });
  const [emailing, setEmailing] = useState(false);
  const emailEnabled = all.data?.emailEnabled ?? false;

  const openEmail = (x: SupportTicket) => {
    setEmailForm({ subject: t('EventWall support', 'Поддержка EventWall'), text: t(`Hello${x.name ? `, ${x.name}` : ''}!\n\n`, `Здравствуйте${x.name ? `, ${x.name}` : ''}!\n\n`) });
    setEmailTo(x);
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo) return;
    setEmailing(true);
    try {
      apply(await supportApi.email(emailTo.id, { subject: emailForm.subject.trim(), text: emailForm.text.trim() }));
      toast(t(`Email sent to ${emailTo.email}`, `Письмо отправлено на ${emailTo.email}`));
      setEmailTo(null);
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setEmailing(false);
    }
  };

  return (
    <>
      {all.loading && !all.data ? (
        <PageLoader label={t('Loading conversations…', 'Загружаем переписки…')} />
      ) : all.error && !all.data ? (
        <div className="p-6"><LoadError message={all.error.message} onRetry={all.reload} /></div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-surface lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Conversations */}
          <div className={cx('flex min-h-0 flex-col overflow-hidden lg:border-r lg:border-line', selectedId && 'hidden lg:flex')}>
            <div className="border-b border-line p-3">
              <h1 className="mb-2.5 px-1 text-lg font-bold tracking-tight" title={t('People who can’t sign in write from the login page — set a new password for their account and tell them in the chat or by email.',
                'Кто не может войти, пишет со страницы входа — поставьте аккаунту новый пароль и сообщите его в чате или на email.')}>
                {t('Support', 'Поддержка')}
              </h1>
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: 'open', label: t('Open', 'Открытые'), count: count('open') },
                { value: 'resolved', label: t('Resolved', 'Решённые'), count: count('resolved') },
                { value: 'all', label: t('All', 'Все'), count: tickets.length },
              ]} />
            </div>
            {list.length === 0 ? (
              <EmptyState icon="message" title={tab === 'open' ? t('No open conversations', 'Открытых переписок нет') : t('No conversations', 'Переписок нет')} />
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {list.map(x => {
                  const last = x.messages.at(-1);
                  return (
                    <li key={x.id}>
                      <button type="button" onClick={() => select(x.id)} aria-current={x.id === selectedId ? 'true' : undefined}
                        className={cx('flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left transition-colors hover:bg-bg', x.id === selectedId && 'bg-accent-soft hover:bg-accent-soft')}>
                        <span className="flex items-center gap-2">
                          <span className={cx('min-w-0 flex-1 truncate', x.unread > 0 ? 'font-bold' : 'font-semibold')}>{x.name || x.email}</span>
                          <span className="shrink-0 text-xs text-muted">{timeAgo(x.lastMessageAt)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                            {last ? `${last.fromAdmin ? t('You: ', 'Вы: ') : ''}${last.text || (last.imageUrl ? t('📷 Picture', '📷 Картинка') : '')}` : '—'}
                          </span>
                          {x.unread > 0 && <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] leading-5 font-bold text-white">{x.unread}</span>}
                        </span>
                        {(x.topic === 'password' || x.status === 'resolved') && (
                          <span className="flex gap-1.5">
                            {x.topic === 'password' && <Badge tone="danger">{TOPIC.password}</Badge>}
                            {x.status === 'resolved' && <Badge tone="success">{t('Resolved', 'Решено')}</Badge>}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Open chat */}
          <div className={cx('flex min-h-0 flex-col overflow-hidden', !selectedId && 'hidden lg:flex')}>
            {!selectedId ? (
              <div className="flex flex-1 items-center justify-center"><EmptyState icon="message" title={t('Choose a conversation', 'Выберите переписку')} /></div>
            ) : !current ? (
              open.error ? <LoadError message={open.error.message} onRetry={open.reload} /> : <PageLoader label={t('Loading chat…', 'Загружаем чат…')} />
            ) : (
              <>
                <div className="border-b border-line p-3 md:px-4">
                  <div className="flex items-start gap-2">
                    <IconButton icon="arrowLeft" label={t('Back to conversations', 'Назад к перепискам')} onClick={() => setSelectedId(null)} className="lg:hidden" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{current.name || current.email}</p>
                      <p className="truncate text-xs text-muted">
                        {current.email} · {current.user
                          ? <>{roleLabel(t, current.user.role)}{current.user.status === 'blocked' && <span className="text-danger"> · {t('blocked', 'заблокирован')}</span>}{!current.user.hasPassword && current.user.google && ' · Google'}</>
                          : t('no account with this email', 'аккаунта с таким email нет')}
                        {' · '}{TOPIC[current.topic]}
                      </p>
                    </div>
                    <IconButton icon="trash" label={t('Delete conversation', 'Удалить переписку')} onClick={() => setDeleting(current)} className="hover:text-danger" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {current.user && (
                      <Link href={`/admin/users?query=${encodeURIComponent(current.email)}`} className={ACTION}>
                        <Icon name="lock" size={14} /> {t('Set new password', 'Новый пароль')}
                      </Link>
                    )}
                    <button type="button" onClick={() => openEmail(current)} className={ACTION}><Icon name="external" size={14} /> {t('Email', 'Написать на email')}</button>
                    {current.status === 'open' ? (
                      <Button size="sm" variant="primary" icon="check" onClick={() => setStatus(current, 'resolved')}>{t('Resolve', 'Решено')}</Button>
                    ) : (
                      <Button size="sm" icon="history" onClick={() => setStatus(current, 'open')}>{t('Reopen', 'Открыть снова')}</Button>
                    )}
                  </div>
                </div>
                <ChatThread className="min-h-0 flex-1" messages={current.messages} mine={m => m.fromAdmin} onSend={reply} />
                {!current.user && (
                  <p className="border-t border-line px-4 py-2 text-xs text-muted">
                    <Icon name="alert" size={12} className="mr-1 inline" />
                    {t('This person has no account, so they won’t see replies here — answer by email.', 'У этого человека нет аккаунта, ответы здесь он не увидит — ответьте на email.')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <Modal open={!!emailTo} onClose={() => setEmailTo(null)} title={t('Email', 'Письмо на email')}>
        {emailTo && (emailEnabled ? (
          <form onSubmit={sendEmail} className="space-y-4">
            <p className="text-sm text-muted">
              {t('To', 'Кому')}: <span className="font-semibold text-fg">{emailTo.email}</span>.{' '}
              {t('The email is also saved in this conversation.', 'Письмо также сохранится в этой переписке.')}
            </p>
            <Field label={t('Subject', 'Тема')} htmlFor="email-subject">
              <Input id="email-subject" required maxLength={150} value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} />
            </Field>
            <Field label={t('Message', 'Текст письма')} htmlFor="email-text">
              <Textarea id="email-text" required maxLength={5000} rows={8} value={emailForm.text} onChange={e => setEmailForm(f => ({ ...f, text: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setEmailTo(null)}>{t('Cancel', 'Отмена')}</Button>
              <Button type="submit" variant="primary" icon="external" disabled={emailing || !emailForm.subject.trim() || !emailForm.text.trim()}>
                {emailing ? t('Sending…', 'Отправляем…') : t('Send email', 'Отправить письмо')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm leading-relaxed">
            <p>{t('Sending email from the site is not set up yet. To turn it on, add to backend/.env and restart the server:',
              'Отправка писем с сайта ещё не настроена. Чтобы включить, добавьте в backend/.env и перезапустите сервер:')}</p>
            <pre className="overflow-x-auto rounded-lg bg-bg p-3 text-xs">{'SMTP_USER=eventwall00@gmail.com\nSMTP_PASS=<app password>'}</pre>
            <p className="text-muted">{t('Gmail: Google Account → Security → 2-Step Verification on → App passwords → create one.',
              'Gmail: аккаунт Google → Безопасность → включите двухэтапную аутентификацию → «Пароли приложений» → создайте пароль.')}</p>
            <p>
              {t('For now you can write from your own mail app: ', 'Пока можно написать из своей почты: ')}
              <a href={`mailto:${emailTo.email}`} className="font-semibold text-accent">{emailTo.email}</a>
            </p>
          </div>
        ))}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title={t('Delete conversation?', 'Удалить переписку?')} confirmLabel={t('Delete', 'Удалить')}
        description={t(`The conversation with ${deleting?.email} will be permanently deleted.`, `Переписка с ${deleting?.email} будет удалена навсегда.`)}
        onConfirm={() => { if (deleting) remove(deleting); }} />
    </>
  );
}
