import type { Metadata } from 'next';
import EventManage from '@/components/pages/event-manage';

export const metadata: Metadata = { title: 'Manage event · EventWall' };

export default async function Page({ params }: PageProps<'/dashboard/events/[id]'>) {
  const { id } = await params;
  return <EventManage id={id} />;
}
