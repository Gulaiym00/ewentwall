import { cookies } from 'next/headers';
import type { Language } from '@/api/types';
import { LOCALE_COOKIE, pickLocale } from './i18n';

/** Visitor's language on the server: `lang` cookie, otherwise Russian. */
export async function getLocale(): Promise<Language> {
  return pickLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
