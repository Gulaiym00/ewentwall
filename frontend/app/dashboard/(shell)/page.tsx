import type { Metadata } from 'next';
import Dashboard from '@/components/pages/dashboard';

export const metadata: Metadata = { title: 'Dashboard · EventWall' };

export default function Page() {
  return <Dashboard />;
}
