'use client';

import ChatThread, { usePolling } from '@/components/ChatThread';
import { useToast } from '@/components/Toast';
import { errorMessage } from '@/api/client';
import { supportApi, type OutgoingMessage } from '@/api/support';
import { useApi } from '@/hooks/useApi';
import { Badge } from '@/ui';
import { Icon } from '@/ui/icons';
import { LoadError, PageLoader } from '@/ui/loader';
import { useT } from '@/utils/locale';

/** Dashboard → Support: the organizer's chat with the admins, across the whole content area. */
export default function Support() {
  const t = useT();
  const toast = useToast();
  const chat = useApi(() => supportApi.myChat(), []);
  usePolling(chat.reload, 5000);

  const send = async (message: OutgoingMessage) => {
    try {
      const next = await supportApi.sendMine(message);
      chat.setData(() => next);
      return true;
    } catch (err) {
      toast(errorMessage(err), 'danger');
      return false;
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-7">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name="message" size={20} /></div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight">{t('EventWall support', 'Поддержка EventWall')}</h1>
          <p className="truncate text-xs text-muted">{t('We usually reply within a few hours', 'Обычно отвечаем в течение нескольких часов')}</p>
        </div>
        {chat.data?.status === 'resolved' && <Badge tone="success" dot>{t('Resolved', 'Вопрос решён')}</Badge>}
      </div>

      {!chat.data && chat.error ? (
        <LoadError message={chat.error.message} onRetry={chat.reload} />
      ) : !chat.data ? (
        <PageLoader label={t('Loading chat…', 'Загружаем чат…')} />
      ) : (
        <ChatThread className="flex-1" messages={chat.data.messages} mine={m => !m.fromAdmin} onSend={send}
          empty={
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name="message" size={22} /></div>
              <p className="font-semibold">{t('How can we help?', 'Чем мы можем помочь?')}</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                {t('Ask anything about your events, photos or account — an admin will answer right here.',
                  'Спросите что угодно о событиях, фото или аккаунте — администратор ответит прямо здесь.')}
              </p>
            </div>
          } />
      )}
    </div>
  );
}
