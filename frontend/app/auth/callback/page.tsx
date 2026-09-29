import type { Metadata } from 'next';
import AuthCallback from '@/components/pages/auth-callback';

export const metadata: Metadata = { title: 'Signing in · EventWall', robots: { index: false } };

export default function Page() {
  return <AuthCallback />;
}
