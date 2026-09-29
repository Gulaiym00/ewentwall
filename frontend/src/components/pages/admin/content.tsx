'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Card, CardHeader, Field, IconButton, Input, PageHeader, Tabs, Textarea } from '@/ui';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/client';
import type { Language as Locale, SiteContent } from '@/api/types';
import { useApi } from '@/hooks/useApi';
import { LoadError, PageLoader } from '@/ui/loader';
import { useT } from '@/utils/locale';

type AllContent = Record<Locale, SiteContent>;
const clone = (c: AllContent) => JSON.parse(JSON.stringify(c)) as AllContent;
const LOCALES: Locale[] = ['en', 'ru'];

export default function AdminContent() {
  const t = useT();
  const content = useApi(async () => {
    const [en, ru] = await Promise.all(LOCALES.map(l => adminApi.content(l)));
    return { en, ru } as AllContent;
  }, []);
  if (content.loading && !content.data) return <PageLoader label={t('Loading content…', 'Загружаем контент…')} />;
  if (!content.data) return <LoadError message={content.error?.message ?? t('Failed to load', 'Не удалось загрузить')} onRetry={content.reload} />;
  return <ContentEditor initial={content.data} />;
}

function ContentEditor({ initial }: { initial: AllContent }) {
  const t = useT();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => clone(initial));
  // The language being edited — the admin's own interface language by default
  const [locale, setLocale] = useState<Locale>(t.locale);
  const [saving, setSaving] = useState(false);

  /** Saves every language that changed; empty FAQ rows are dropped. */
  const saveContent = async () => {
    setSaving(true);
    try {
      const next = clone(draft);
      for (const l of LOCALES) {
        next[l].faq = next[l].faq.filter(f => f.q.trim() && f.a.trim());
        if (JSON.stringify(next[l]) !== JSON.stringify(saved[l])) next[l] = await adminApi.saveContent(l, next[l]);
      }
      setSaved(next);
      setDraft(clone(next));
      toast(t('Content published — the landing page updates within a minute', 'Контент опубликован — главная обновится в течение минуты'));
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const c = draft[locale];
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) =>
    setDraft(d => ({ ...d, [locale]: { ...d[locale], [key]: value } }));

  const setFaq = (i: number, field: 'q' | 'a', value: string) =>
    set('faq', c.faq.map((f, j) => (j === i ? { ...f, [field]: value } : f)));

  const moveFaq = (i: number, dir: -1 | 1) => {
    const next = [...c.faq];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    set('faq', next);
  };

  const [titleFirst, ...titleRest] = c.heroTitle.split('. ');

  return (
    <>
      <PageHeader title={t('Website content', 'Контент сайта')}
        description={t('Edit the public landing page. Changes go live after saving.', 'Редактирование главной страницы. Изменения появятся после сохранения.')} />

      <Tabs value={locale} onChange={setLocale} className="mb-4" tabs={[
        { value: 'en', label: 'English' },
        { value: 'ru', label: 'Русский' },
      ]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('Hero section', 'Первый экран')} />
            <div className="space-y-4">
              <Field label={t('Headline', 'Заголовок')} htmlFor="c-title" hint={t('The part after the first period is shown in italic accent color.', 'Часть после первой точки выделяется курсивом и цветом.')}>
                <Input id="c-title" value={c.heroTitle} onChange={e => set('heroTitle', e.target.value)} maxLength={60} />
              </Field>
              <Field label={t('Subheadline', 'Подзаголовок')} htmlFor="c-sub" hint={t(`${c.heroSubtitle.length}/160 characters`, `${c.heroSubtitle.length}/160 символов`)}>
                <Textarea id="c-sub" rows={3} value={c.heroSubtitle} onChange={e => set('heroSubtitle', e.target.value)} maxLength={160} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('Primary button', 'Основная кнопка')} htmlFor="c-cta1"><Input id="c-cta1" value={c.ctaPrimary} onChange={e => set('ctaPrimary', e.target.value)} maxLength={28} /></Field>
                <Field label={t('Secondary button', 'Вторая кнопка')} htmlFor="c-cta2"><Input id="c-cta2" value={c.ctaSecondary} onChange={e => set('ctaSecondary', e.target.value)} maxLength={28} /></Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`FAQ · ${c.faq.length}`}
              action={<Button size="sm" icon="plus" onClick={() => set('faq', [...c.faq, { q: '', a: '' }])}>{t('Add question', 'Добавить вопрос')}</Button>} />
            <ol className="space-y-3">
              {c.faq.map((f, i) => (
                <li key={i} className="rounded-xl border border-line bg-bg p-3 sm:p-4">
                  <div className="mb-3 flex items-center gap-1">
                    <span className="mr-auto text-xs font-bold text-muted">{t('Question', 'Вопрос')} {i + 1}</span>
                    <IconButton icon="chevronLeft" label={t('Move up', 'Выше')} className="rotate-90" disabled={i === 0} onClick={() => moveFaq(i, -1)} />
                    <IconButton icon="chevronRight" label={t('Move down', 'Ниже')} className="rotate-90" disabled={i === c.faq.length - 1} onClick={() => moveFaq(i, 1)} />
                    <IconButton icon="trash" label={t('Delete question', 'Удалить вопрос')} className="hover:text-danger" onClick={() => set('faq', c.faq.filter((_, j) => j !== i))} />
                  </div>
                  <div className="space-y-2">
                    <Input aria-label={`${t('Question', 'Вопрос')} ${i + 1}`} placeholder={t('Question', 'Вопрос')} value={f.q} onChange={e => setFaq(i, 'q', e.target.value)} className="bg-surface font-semibold" />
                    <Textarea aria-label={`${t('Answer', 'Ответ')} ${i + 1}`} placeholder={t('Answer', 'Ответ')} rows={2} value={f.a} onChange={e => setFaq(i, 'a', e.target.value)} className="bg-surface" />
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader title={t('Preview', 'Предпросмотр')} />
            <div className="rounded-xl border border-line bg-bg p-5">
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[10px] font-bold tracking-wider text-muted uppercase">
                <span className="live-dot size-1.5 rounded-full bg-accent" /> {locale === 'ru' ? 'Фото в реальном времени' : 'Live photo sharing'}
              </p>
              <h3 className="font-serif text-[32px] leading-[1.05] font-bold tracking-tight [overflow-wrap:anywhere]">
                {titleFirst}{titleRest.length > 0 && '. '}
                {titleRest.length > 0 && <em className="text-accent">{titleRest.join('. ')}</em>}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{c.heroSubtitle}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white">{c.ctaPrimary || '—'}</span>
                <span className="rounded-lg border border-line px-3 py-2 text-xs font-semibold">{c.ctaSecondary || '—'}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="notif-slide sticky bottom-4 z-20 mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface p-2 pl-4 shadow-lg">
          <span className="mr-auto text-sm font-semibold">{t('Unsaved changes', 'Есть несохранённые изменения')}</span>
          <Button size="sm" variant="ghost" onClick={() => setDraft(clone(saved))}>{t('Discard', 'Отменить')}</Button>
          <Button size="sm" variant="primary" disabled={saving} onClick={saveContent}>{saving ? t('Saving…', 'Сохраняем…') : t('Save & publish', 'Сохранить и опубликовать')}</Button>
        </div>
      )}
    </>
  );
}
