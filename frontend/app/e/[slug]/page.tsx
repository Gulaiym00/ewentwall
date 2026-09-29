import type { Metadata } from 'next';
import GuestEvent from '@/components/pages/guest-event';

export const metadata: Metadata = { title: 'Event · EventWall', robots: { index: false } };

export default async function Page({ params }: PageProps<'/e/[slug]'>) {
  const { slug } = await params;
  return <GuestEvent slug={slug} />;
}
