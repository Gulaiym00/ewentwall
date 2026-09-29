import { cookies, headers } from 'next/headers';
import type { Language } from '@/api/types';
import { LOCALE_COOKIE, pickLocale } from './i18n';

/** Visitor's language on the server: `lang` cookie, then Accept-Language. */
export async function getLocale(): Promise<Language> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get('accept-language'));
}
