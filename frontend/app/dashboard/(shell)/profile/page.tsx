import type { Metadata } from 'next';
import Profile from '@/components/pages/profile';

export const metadata: Metadata = { title: 'Profile · EventWall' };

export default function Page() {
  return <Profile />;
}
