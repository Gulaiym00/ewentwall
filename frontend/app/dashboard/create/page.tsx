import type { Metadata } from 'next';
import CreateEvent from '@/components/pages/create-event';

export const metadata: Metadata = { title: 'Create event · EventWall' };

export default function Page() {
  return <CreateEvent />;
}
