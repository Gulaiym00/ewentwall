import type { Metadata } from 'next';
import Landing from '@/components/pages/landing';
import { landingDict } from '@/utils/i18n';
import { getLocale } from '@/utils/locale.server';

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = landingDict[await getLocale()];
  return { title: { absolute: meta.title }, description: meta.description };
}

export default async function Page() {
  return <Landing locale={await getLocale()} />;
}
