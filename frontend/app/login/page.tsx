import type { Metadata } from 'next';
import Auth from '@/components/pages/auth';

export const metadata: Metadata = { title: 'Sign in · EventWall' };

export default function Page() {
  return <Auth mode="login" />;
}
