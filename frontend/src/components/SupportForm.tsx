'use client';

import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { supportApi, type SupportTopic } from '@/api/support';
import { Button, Field, Input, Select, Textarea } from '@/ui';
import { Icon } from '@/ui/icons';
import { useT } from '@/utils/locale';

/**
 * Message to support. Used on the login page ("Forgot password?") and in Dashboard → Support.
 * Tickets land in Admin → Support, where the admin can reset the password of the matching account.
 */
export default function SupportForm({ initialEmail = '', initialName = '', initialTopic = 'other', lockEmail = false }:
  { initialEmail?: string; initialName?: string; initialTopic?: SupportTopic; lockEmail?: boolean }) {
  const t = useT();
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [topic, setTopic] = useState<SupportTopic>(initialTopic);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const TOPICS: { value: SupportTopic; label: string }[] = [
    { value: 'password', label: t("Can't sign in / forgot password", 'Не могу войти / забыл пароль') },
    { value: 'account', label: t('My account', 'Мой аккаунт') },
    { value: 'event', label: t('An event or photos', 'Событие или фото') },
    { value: 'other', label: t('Something else', 'Другое') },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await supportApi.send({ email: email.trim(), name: name.trim() || undefined, topic, message: message.trim() });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name="check" size={20} /></div>
        <p className="font-semibold">{t('Message sent', 'Сообщение отправлено')}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {topic === 'password'
            ? t(`We'll set a new password for your account and send it to ${email}.`, `Мы установим новый пароль для вашего аккаунта и пришлём его на ${email}.`)
            : t(`We'll reply to ${email} as soon as we can.`, `Мы ответим на ${email} как можно скорее.`)}
        </p>
        <Button size="sm" className="mt-4" onClick={() => { setSent(false); setMessage(''); }}>{t('Send another message', 'Написать ещё')}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-[10px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{error}</p>}
      <Field label={t('Your email', 'Ваш email')} htmlFor="support-email" hint={t('The one you signed up with — we reply here.', 'Тот, с которым вы регистрировались — ответим на него.')}>
        <Input id="support-email" type="email" required maxLength={254} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
          value={email} onChange={e => setEmail(e.target.value)} readOnly={lockEmail} placeholder="you@example.com" />
      </Field>
      {!lockEmail && (
        <Field label={t('Name (optional)', 'Имя (необязательно)')} htmlFor="support-name">
          <Input id="support-name" maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
        </Field>
      )}
      <Field label={t('Topic', 'Тема')} htmlFor="support-topic">
        <Select id="support-topic" value={topic} onChange={e => setTopic(e.target.value as SupportTopic)} options={TOPICS} />
      </Field>
      <Field label={t('Message', 'Сообщение')} htmlFor="support-message">
        <Textarea id="support-message" required minLength={5} maxLength={2000} rows={4} value={message} onChange={e => setMessage(e.target.value)}
          placeholder={topic === 'password'
            ? t('E.g. I forgot my password and can’t sign in.', 'Например: забыл пароль и не могу войти.')
            : t('How can we help?', 'Чем мы можем помочь?')} />
      </Field>
      <Button type="submit" variant="primary" icon="message" className="w-full" disabled={sending || message.trim().length < 5}>
        {sending ? t('Sending…', 'Отправляем…') : t('Send to support', 'Отправить в поддержку')}
      </Button>
    </form>
  );
}
