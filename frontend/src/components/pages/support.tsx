'use client';

import SupportForm from '@/components/SupportForm';
import { useOrganizer } from '@/hooks/useOrganizer';
import { Card, PageHeader } from '@/ui';
import { useT } from '@/utils/locale';

export default function Support() {
  const t = useT();
  const { profile } = useOrganizer();
  const user = profile!; // OrganizerShell renders pages only for signed-in users

  return (
    <>
      <PageHeader title={t('Support', 'Поддержка')}
        description={t('Something not working or have a question? Write to us — we reply to your account email.',
          'Что-то не работает или есть вопрос? Напишите нам — ответим на email вашего аккаунта.')} />
      <Card className="max-w-xl">
        <SupportForm initialEmail={user.email} initialName={user.name} lockEmail />
      </Card>
    </>
  );
}
