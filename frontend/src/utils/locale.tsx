'use client';

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/api/types';
import { saveLocale } from './i18n';
import { setFormatLocale } from './format';

// Interface language for the app pages (organizer, admin, guest). The server picks the
// initial value from the `lang` cookie; switching saves the cookie and re-renders.

interface LocaleCtx { locale: Language; setLocale: (l: Language) => void; switching: boolean }

const Ctx = createContext<LocaleCtx>({ locale: 'ru', setLocale: () => {}, switching: false });

export function LocaleProvider({ initial, children }: { initial: Language; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setState] = useState(initial);
  const [switching, startSwitch] = useTransition();

  // The landing header switches the cookie and refreshes: follow the server's new value.
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setState(initial);
  }
  if (typeof window !== 'undefined') setFormatLocale(locale);

  const setLocale = useCallback((l: Language) => {
    saveLocale(l);
    setFormatLocale(l);
    document.documentElement.lang = l;
    setState(l);
    startSwitch(() => router.refresh());
  }, [router]);

  const value = useMemo(() => ({ locale, setLocale, switching }), [locale, setLocale, switching]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLocale = () => useContext(Ctx);

type PluralForms = { en: [one: string, many: string]; ru: [one: string, few: string, many: string] };

/** Russian plural category: 1 фото / 2 фото / 5 фото. */
function ruForm(n: number): 0 | 1 | 2 {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 2;
  if (b === 1) return 0;
  if (b >= 2 && b <= 4) return 1;
  return 2;
}

export interface Translate {
  (en: string, ru: string): string;
  locale: Language;
  /** Word only: t.word(3, ['photo', 'photos'], ['фото', 'фото', 'фото']) */
  word: (n: number, en: PluralForms['en'], ru: PluralForms['ru']) => string;
  /** Number + word: "3 photos" / "3 фото" */
  count: (n: number, en: PluralForms['en'], ru: PluralForms['ru']) => string;
}

function makeT(locale: Language): Translate {
  const word: Translate['word'] = (n, en, ru) => (locale === 'ru' ? ru[ruForm(n)] : en[n === 1 ? 0 : 1]);
  return Object.assign((en: string, ru: string) => (locale === 'ru' ? ru : en), {
    locale,
    word,
    count: ((n, en, ru) => `${n.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')} ${word(n, en, ru)}`) as Translate['count'],
  });
}

/** `const t = useT(); t('Save', 'Сохранить')` — both texts stay next to the markup. */
export function useT(): Translate {
  const { locale } = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}

/** Small EN/RU toggle used in the app shells and on the guest page. */
export function LanguageToggle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { locale, setLocale, switching } = useLocale();
  return (
    <button type="button" onClick={() => setLocale(locale === 'en' ? 'ru' : 'en')} disabled={switching}
      aria-label={locale === 'en' ? 'Переключить на русский' : 'Switch to English'} className={className} style={style}>
      {locale.toUpperCase()}
    </button>
  );
}
