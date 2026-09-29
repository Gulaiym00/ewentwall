import type { Metadata } from 'next';
import MyEvents from '@/components/pages/my-events';

export const metadata: Metadata = { title: 'My Events · EventWall' };

export default function Page() {
  return <MyEvents />;
}
