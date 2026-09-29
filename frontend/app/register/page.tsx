import type { Metadata } from 'next';
import Auth from '@/components/pages/auth';

export const metadata: Metadata = { title: 'Create account · EventWall' };

export default function Page() {
  return <Auth mode="register" />;
}
